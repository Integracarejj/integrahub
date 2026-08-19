import "./PackageSubmissionProgress.css";

export default function PackageSubmissionProgress() {
    return (
        <div className="package-submission-progress" role="status" aria-live="polite">
            <span className="package-submission-spinner" aria-hidden="true" />
            <div>
                <strong>Submitting package...</strong>
                <div>Creating your project and securely uploading your package.</div>
                <div>This may take a moment.</div>
            </div>
        </div>
    );
}
