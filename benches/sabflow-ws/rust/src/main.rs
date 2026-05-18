//! SabFlow WS gateway — Rust candidate.
//!
//! Track A Phase 1 bench. Same semantics as `benches/sabflow-ws/node/server.js`:
//! single fixed room, fan-out broadcast on receive, opaque binary frames.
//!
//! Stub only. To build:
//!     cd benches/sabflow-ws/rust && cargo build --release
//! To run:
//!     ./target/release/sabflow-ws-bench --port 9001
//!
//! This crate is intentionally outside the SabNode `rust/` workspace so the
//! bench has zero blast radius on shipping crates.

use std::collections::HashMap;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::tungstenite::Message;

/// Per-room state. A `broadcast` channel is the natural fit: every connected
/// peer gets its own `Receiver`, sender-side back-pressure is per-room, and
/// dropping a slow client doesn't stall the others.
struct Room {
    tx: broadcast::Sender<(u64, Vec<u8>)>,
}

impl Room {
    fn new() -> Self {
        // Capacity tuned for the bench: at N=200 and 10 msg/s, worst-case lag
        // is ~2k frames if a peer stalls for a second. 4096 gives headroom
        // without making the channel itself the bottleneck.
        let (tx, _rx) = broadcast::channel(4096);
        Self { tx }
    }
}

#[derive(Default)]
struct Registry {
    rooms: HashMap<String, Arc<Room>>,
}

impl Registry {
    fn get_or_create(&mut self, id: &str) -> Arc<Room> {
        if let Some(r) = self.rooms.get(id) {
            return r.clone();
        }
        let room = Arc::new(Room::new());
        self.rooms.insert(id.to_string(), room.clone());
        room
    }
}

struct Args {
    port: u16,
    room: String,
}

fn parse_args() -> Args {
    let mut port: u16 = 9001;
    let mut room = String::from("default");
    let mut it = std::env::args().skip(1);
    while let Some(k) = it.next() {
        match k.as_str() {
            "--port" => {
                if let Some(v) = it.next() {
                    port = v.parse().expect("--port must be u16");
                }
            }
            "--room" => {
                if let Some(v) = it.next() {
                    room = v;
                }
            }
            _ => {}
        }
    }
    Args { port, room }
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let args = parse_args();
    let addr = format!("127.0.0.1:{}", args.port);
    let listener = TcpListener::bind(&addr).await?;

    // The driver script greps for this exact line to know the server is up.
    println!("[sabflow-ws/rust] listening on {}", addr);

    let registry: Arc<Mutex<Registry>> = Arc::new(Mutex::new(Registry::default()));

    // SIGTERM / SIGINT handling — the bench driver kills the server between
    // runs, so we want a clean exit instead of an orphaned port.
    let shutdown = tokio::signal::ctrl_c();
    tokio::pin!(shutdown);

    let mut next_peer_id: u64 = 0;

    loop {
        tokio::select! {
            res = listener.accept() => {
                let (stream, _peer_addr) = match res {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let peer_id = next_peer_id;
                next_peer_id = next_peer_id.wrapping_add(1);

                let room_id = args.room.clone();
                let room = {
                    let mut g = registry.lock().await;
                    g.get_or_create(&room_id)
                };

                tokio::spawn(handle_conn(stream, peer_id, room));
            }
            _ = &mut shutdown => {
                break;
            }
        }
    }

    Ok(())
}

async fn handle_conn(stream: TcpStream, peer_id: u64, room: Arc<Room>) {
    let ws = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return,
    };
    let (mut sink, mut source) = ws.split();

    // Each connection gets its own subscriber. We filter out frames whose
    // origin id matches our own peer id so the broadcast does not echo to
    // sender — matches the Node server semantics.
    let mut rx = room.tx.subscribe();
    let tx = room.tx.clone();

    // Outbound task: forward room broadcasts to this peer's socket.
    let send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok((origin, bytes)) => {
                    if origin == peer_id {
                        continue;
                    }
                    if sink.send(Message::Binary(bytes)).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => {
                    // Slow consumer — drop and keep going. In the real
                    // gateway we'd disconnect; for the bench we just skip so
                    // a single hiccup does not poison the run.
                    continue;
                }
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    // Inbound loop: every binary frame is fanned out via the broadcast tx.
    while let Some(msg) = source.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                // Ignoring the SendError: if it fails, the channel is closed
                // and the spawned send task will exit on its own.
                let _ = tx.send((peer_id, bytes));
            }
            Ok(Message::Close(_)) | Err(_) => break,
            // Text frames are not used by the bench — quietly drop.
            _ => {}
        }
    }

    send_task.abort();
}
