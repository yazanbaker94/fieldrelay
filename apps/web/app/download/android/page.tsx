import { PrototypeDisclaimer, PublicHeader } from '@/components/fieldrelay/public-header';

const releaseBase = 'https://github.com/yazanbaker94/fieldrelay/releases/latest/download';

export default function AndroidDownloadPage() {
  return (
    <main className="public-inner">
      <PublicHeader />
      <section className="download-layout">
        <div className="download-copy">
          <p>Android field client / verified APK</p>
          <h1>Carry the record<br />through dead zones.</h1>
          <p>The FieldRelay Android prototype saves work to an Expo SQLite ledger, survives restart, exposes every pending operation, and synchronizes with explicit idempotency, result-recovery, and conflict states.</p>
          <a className="download-action" href={`${releaseBase}/fieldrelay-android.apk`}>Download Android APK</a>
          <a className="download-checksum" href={`${releaseBase}/fieldrelay-android.apk.sha256`}>View SHA-256 checksum →</a>
          <span className="build-note">Android 7+ · arm64-v8a · synthetic portfolio data</span>
        </div>
        <div className="apk-manifest">
          <header><span>Build manifest</span><code>APK / 1.0.0</code></header>
          <dl>
            <div><dt>Package</dt><dd>video.swoop.fieldrelay</dd></div>
            <div><dt>Variant</dt><dd>Standalone reviewer build · release-signed</dd></div>
            <div><dt>Minimum Android</dt><dd>API 24 / Android 7.0</dd></div>
            <div><dt>Architecture</dt><dd>arm64-v8a</dd></div>
            <div><dt>Bundle</dt><dd>JavaScript embedded · offline launch verified</dd></div>
            <div><dt>Checksum</dt><dd>SHA-256 published beside APK</dd></div>
          </dl>
          <aside><strong>Install note</strong><p>This portfolio artifact is signed with a dedicated FieldRelay release certificate and distributed directly rather than through Google Play. Android may ask permission to install from your browser.</p></aside>
        </div>
      </section>
      <section className="mobile-behavior">
        <header><p>What the build proves</p><h2>Offline is an operating state,<br />not an error screen.</h2></header>
        <div>
          <article><span>01</span><strong>Save locally</strong><p>Required data and a unique operation key persist in SQLite before any network request.</p></article>
          <article><span>02</span><strong>Know what happens next</strong><p>Human language explains waiting, checking, synchronization, and review states.</p></article>
          <article><span>03</span><strong>Recover safely</strong><p>Lost responses and server conflicts resolve without silent overwrite or duplication.</p></article>
        </div>
      </section>
      <PrototypeDisclaimer />
    </main>
  );
}
