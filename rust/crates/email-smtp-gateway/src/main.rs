use clap::Parser;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tracing::{error, info, warn};

#[derive(Parser, Debug, Clone)]
#[command(author, version, about = "SMTP Gateway for SabNode Inbound Email")]
struct Args {
    /// Address to listen on for SMTP traffic
    #[arg(short, long, env = "SMTP_LISTEN_ADDR", default_value = "0.0.0.0:2525")]
    listen: SocketAddr,

    /// URL of the internal raw ingest endpoint (e.g., http://sabnode-api/v1/email/inbound/raw)
    #[arg(
        long,
        env = "SMTP_TARGET_URL",
        default_value = "http://localhost:3000/v1/email/inbound/raw"
    )]
    target_url: String,

    /// Domain names that we accept mail for (can be specified multiple times)
    #[arg(long, env = "SMTP_DOMAINS")]
    domains: Vec<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let state = Arc::new(AppState {
        args: args.clone(),
        client,
    });

    info!("Starting SMTP gateway on {}", args.listen);
    let listener = TcpListener::bind(args.listen).await?;

    loop {
        let (stream, addr) = listener.accept().await?;
        let state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, addr, state).await {
                error!(%addr, error = %e, "connection error");
            }
        });
    }
}

struct AppState {
    args: Args,
    client: reqwest::Client,
}

async fn handle_connection(
    mut stream: TcpStream,
    addr: SocketAddr,
    state: Arc<AppState>,
) -> anyhow::Result<()> {
    info!(%addr, "accepted connection");

    // SMTP greeting
    stream
        .write_all(b"220 sabsms-smtp-gateway ESMTP\r\n")
        .await?;

    let (read_half, mut write_half) = stream.split();
    let mut reader = BufReader::new(read_half);
    let mut line = String::new();

    let mut receiving_data = false;
    let mut data = Vec::new();
    let mut recipients: Vec<String> = Vec::new();

    loop {
        if receiving_data {
            line.clear();
            let n = reader.read_line(&mut line).await?;
            if n == 0 {
                break;
            }

            if line == ".\r\n" || line == ".\n" {
                receiving_data = false;

                let payload = std::mem::take(&mut data);
                let rcpts = std::mem::take(&mut recipients);

                let mut success = true;
                for rcpt in rcpts {
                    let url = format!("{}/{}", state.args.target_url, rcpt);
                    let res = state
                        .client
                        .post(&url)
                        .header("Content-Type", "message/rfc822")
                        .body(payload.clone())
                        .send()
                        .await;

                    match res {
                        Ok(resp) if resp.status().is_success() => {
                            info!(%addr, token = %rcpt, "successfully delivered to API");
                        }
                        Ok(resp) => {
                            warn!(%addr, token = %rcpt, status = %resp.status(), "API rejected message");
                            success = false;
                        }
                        Err(e) => {
                            error!(%addr, token = %rcpt, error = %e, "API request failed");
                            success = false;
                        }
                    }
                }

                if success {
                    write_half
                        .write_all(b"250 OK Message accepted for delivery\r\n")
                        .await?;
                } else {
                    write_half
                        .write_all(b"451 Requested action aborted: local error in processing\r\n")
                        .await?;
                }
            } else {
                // Handle dot-stuffing
                if line.starts_with("..") {
                    data.extend_from_slice(&line.as_bytes()[1..]);
                } else {
                    data.extend_from_slice(line.as_bytes());
                }
            }
            continue;
        }

        line.clear();
        let n = reader.read_line(&mut line).await?;
        if n == 0 {
            break;
        }

        let cmd = line.trim_end();
        let upper_cmd = cmd.to_ascii_uppercase();

        if upper_cmd.starts_with("HELO") || upper_cmd.starts_with("EHLO") {
            write_half.write_all(b"250 sabsms-smtp-gateway\r\n").await?;
        } else if upper_cmd.starts_with("MAIL FROM:") {
            write_half.write_all(b"250 OK\r\n").await?;
        } else if upper_cmd.starts_with("RCPT TO:") {
            // Extract the recipient address
            let addr_part = cmd[8..].trim();
            let addr_clean = strip_angle_brackets(addr_part);

            // Extract token (local part)
            if let Some((local, domain)) = addr_clean.split_once('@') {
                let valid_domain = state.args.domains.is_empty()
                    || state
                        .args
                        .domains
                        .iter()
                        .any(|d| d.eq_ignore_ascii_case(domain));
                if valid_domain {
                    recipients.push(local.to_string());
                    write_half.write_all(b"250 OK\r\n").await?;
                } else {
                    write_half.write_all(b"550 Relay access denied\r\n").await?;
                }
            } else {
                write_half
                    .write_all(b"501 Syntax error in parameters or arguments\r\n")
                    .await?;
            }
        } else if upper_cmd == "DATA" {
            if recipients.is_empty() {
                write_half
                    .write_all(b"503 Bad sequence of commands\r\n")
                    .await?;
            } else {
                write_half
                    .write_all(b"354 Start mail input; end with <CRLF>.<CRLF>\r\n")
                    .await?;
                receiving_data = true;
            }
        } else if upper_cmd == "QUIT" {
            write_half
                .write_all(b"221 sabsms-smtp-gateway Service closing transmission channel\r\n")
                .await?;
            break;
        } else if upper_cmd == "RSET" {
            recipients.clear();
            data.clear();
            write_half.write_all(b"250 OK\r\n").await?;
        } else if upper_cmd == "NOOP" {
            write_half.write_all(b"250 OK\r\n").await?;
        } else {
            write_half
                .write_all(b"500 Command not recognized\r\n")
                .await?;
        }
    }

    info!(%addr, "connection closed");
    Ok(())
}

fn strip_angle_brackets(s: &str) -> &str {
    s.trim()
        .strip_prefix('<')
        .and_then(|s| s.strip_suffix('>'))
        .unwrap_or(s)
}
