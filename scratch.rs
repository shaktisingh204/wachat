use lettre::transport::smtp::AsyncSmtpTransport;
use lettre::Tokio1Executor;
fn check_clone(t: AsyncSmtpTransport<Tokio1Executor>) {
    let _c = t.clone();
}
