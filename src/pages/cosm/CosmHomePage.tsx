import "./CosmHomePage.css";

export default function CosmHomePage() {
    return (
        <div className="cosm-page">
            <header className="cosm-header">
                <span className="cosm-eyebrow">IntegraIQ</span>
                <h1>COSM</h1>
                <p>Centralized access to IntegraCare operational standards and knowledge.</p>
            </header>

            <section className="cosm-foundation" aria-labelledby="cosm-foundation-title">
                <div className="cosm-foundation-mark" aria-hidden="true">C</div>
                <div>
                    <h2 id="cosm-foundation-title">Knowledge foundation</h2>
                    <p>The secure COSM workspace is ready. Knowledge capabilities will be introduced in future releases.</p>
                </div>
            </section>
        </div>
    );
}
