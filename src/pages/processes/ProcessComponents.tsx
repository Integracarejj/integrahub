import { Link } from "react-router-dom";
import type { BusinessProcessStep, BusinessProcessStepSystem, ProcessRelatedIntegration } from "../../types/businessProcess";

export function getActorLabel(step: BusinessProcessStep): string | null {
    const name = step.stepName.toLowerCase();
    if (name.includes("recruit") || name.includes("sourc") || name.includes("applicant")) return "Candidate";
    if (name.includes("hiring") || name.includes("offer") || name.includes("onboard") || name.includes("orient")) return "New Hire";
    return null;
}

export function systemLabel(count: number): string {
    return count === 1 ? "1 system" : `${count} systems`;
}

export function ProcessActorBadge({ label }: { label: string }) {
    return <span className="pv-actor-badge">{label}</span>;
}

export function ProcessSystemChip({
    system,
    onSystemClick,
}: {
    system: BusinessProcessStepSystem;
    onSystemClick?: (applicationId: string) => void;
}) {
    return (
        <div
            className="pv-chip"
            style={onSystemClick ? { cursor: "pointer" } : undefined}
            onClick={onSystemClick ? () => onSystemClick(system.applicationId) : undefined}
        >
            <Link
                to={`/applications/${system.applicationId}`}
                className="pv-chip-name"
                onClick={e => e.stopPropagation()}
            >
                {system.applicationName}
            </Link>
            {system.systemCategory && <span className="pv-chip-cat">{system.systemCategory}</span>}
        </div>
    );
}

export function ProcessSystemDetailItem({
    system,
    onSystemClick,
}: {
    system: BusinessProcessStepSystem;
    onSystemClick?: (applicationId: string) => void;
}) {
    return (
        <div
            className="pv-detail-item"
            style={onSystemClick ? { cursor: "pointer" } : undefined}
            onClick={onSystemClick ? () => onSystemClick(system.applicationId) : undefined}
        >
            <div className="pv-detail-top">
                <Link
                    to={`/applications/${system.applicationId}`}
                    className="pv-detail-name"
                    onClick={e => e.stopPropagation()}
                >
                    {system.applicationName}
                </Link>
                <div className="pv-detail-badges">
                    {system.systemCategory && <span className="pv-badge">{system.systemCategory}</span>}
                    {system.businessCriticality && (
                        <span className={`pv-badge pv-crit-${system.businessCriticality.toLowerCase()}`}>
                            {system.businessCriticality}
                        </span>
                    )}
                    {system.status === "Active" && <span className="pv-badge pv-badge-active">Active</span>}
                    {system.status === "Retired" && <span className="pv-badge pv-badge-retired">Retired</span>}
                    {system.processRole && <span className="pv-badge pv-badge-role">{system.processRole}</span>}
                </div>
            </div>
            {system.notes && <p className="pv-detail-notes">{system.notes}</p>}
        </div>
    );
}

export function ProcessSystemDetailList({
    systems,
    onSystemClick,
}: {
    systems: BusinessProcessStepSystem[];
    onSystemClick?: (applicationId: string) => void;
}) {
    if (systems.length === 0) return null;
    return (
        <div className="pv-detail-list">
            {systems.map(sys => (
                <ProcessSystemDetailItem key={sys.mappingId} system={sys} onSystemClick={onSystemClick} />
            ))}
        </div>
    );
}

export function ProcessStageCard({
    step,
    idx,
    expanded,
    onToggle,
    onStageClick,
    onSystemClick,
}: {
    step: BusinessProcessStep;
    idx: number;
    expanded: boolean;
    onToggle: () => void;
    onStageClick?: (step: BusinessProcessStep) => void;
    onSystemClick?: (applicationId: string) => void;
}) {
    const actor = getActorLabel(step);

    return (
        <div
            className="pv-stage"
            style={onStageClick ? { cursor: "pointer" } : undefined}
            onClick={onStageClick ? () => onStageClick(step) : undefined}
        >
            <span className="pv-stage-num">{idx + 1}</span>

            <div className="pv-stage-body">
                <div className="pv-stage-hdr">
                    <div className="pv-stage-hdr-l">
                        {actor && <ProcessActorBadge label={actor} />}
                        <h3 className="pv-stage-name">{step.stepName}</h3>
                        {step.stepDescription && (
                            <p className="pv-stage-desc">{step.stepDescription}</p>
                        )}
                    </div>
                    <div className="pv-stage-hdr-r">
                        {step.systems.length > 0 && (
                            <>
                                <span className="pv-stage-count">{systemLabel(step.systems.length)}</span>
                                <button
                                    className={`pv-expand-btn${expanded ? " pv-expand-btn--open" : ""}`}
                                    onClick={e => { e.stopPropagation(); onToggle(); }}
                                    title={expanded ? "Hide details" : "Show details"}
                                >
                                    {expanded ? "−" : "+"}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {step.systems.length === 0 ? (
                    <p className="pv-stage-empty">No systems mapped</p>
                ) : expanded ? (
                    <ProcessSystemDetailList systems={step.systems} onSystemClick={onSystemClick} />
                ) : (
                    <div className="pv-chips">
                        {step.systems.map(sys => (
                            <ProcessSystemChip key={sys.mappingId} system={sys} onSystemClick={onSystemClick} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function splitDelimited(value: string | null): string[] {
    if (!value) return [];
    const parts = value.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [];
}

export function ProcessDrawerSystemCard({ system }: { system: BusinessProcessStepSystem }) {
    return (
        <div className="pv-drawer-system">
            <Link to={`/applications/${system.applicationId}`} className="pv-drawer-system-name" onClick={e => e.stopPropagation()}>
                {system.applicationName}
            </Link>
            <div className="pv-drawer-system-tags">
                {system.systemCategory && <span className="pv-tag">{system.systemCategory}</span>}
                {system.businessCriticality && (
                    <span className={`pv-tag pv-crit-${system.businessCriticality.toLowerCase()}`}>
                        {system.businessCriticality}
                    </span>
                )}
                {system.status === "Active" && <span className="pv-tag pv-tag-active">Active</span>}
                {system.status === "Retired" && <span className="pv-tag pv-tag-retired">Retired</span>}
            </div>
            {system.processRole && <p className="pv-drawer-system-role">Role: {system.processRole}</p>}
            {system.notes && <p className="pv-drawer-system-note">{system.notes}</p>}
        </div>
    );
}

export function DrawerSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
    return (
        <div className="pv-drawer-section">
            <h3 className="pv-drawer-section-title">
                {title}
                {count !== undefined && <span className="pv-drawer-count">{count}</span>}
            </h3>
            {children}
        </div>
    );
}

export function DrawerBulletList({ items }: { items: string[] }) {
    return (
        <ul className="pv-drawer-bullets">
            {items.map((item, i) => (
                <li key={i}>{item}</li>
            ))}
        </ul>
    );
}

export function DrawerPillList({ items }: { items: string[] }) {
    return (
        <div className="pv-drawer-pills">
            {items.map((item, i) => (
                <span key={i} className="pv-drawer-pill">{item}</span>
            ))}
        </div>
    );
}

export function ProcessDrawerIntegrationCard({ integration }: { integration: ProcessRelatedIntegration }) {
    const metaParts = [integration.integrationType, integration.method, integration.frequency].filter(Boolean);
    return (
        <div className="pv-drawer-integration">
            <div className="pv-drawer-int-hdr">
                <span className="pv-drawer-int-arrow">{integration.sourceApplicationName}</span>
                <span className="pv-drawer-int-symbol">→</span>
                <span className="pv-drawer-int-arrow">{integration.targetApplicationName}</span>
                {integration.status && (
                    <span className={`pv-tag${integration.status === "Active" ? " pv-tag-active" : ""}`}>{integration.status}</span>
                )}
            </div>
            {metaParts.length > 0 && (
                <p className="pv-drawer-int-meta">{metaParts.join(" · ")}</p>
            )}
            {integration.businessPurpose && (
                <p className="pv-drawer-int-purpose">Purpose: {integration.businessPurpose}</p>
            )}
            {integration.dataExchanged && (
                <p className="pv-drawer-int-data">Data: {integration.dataExchanged}</p>
            )}
        </div>
    );
}

export function ProcessStageDrawer({ stage, onClose }: { stage: BusinessProcessStep; onClose: () => void }) {
    const actor = getActorLabel(stage);
    const businessPurpose = stage.businessPurpose || stage.stepDescription;
    const keyActivityItems = splitDelimited(stage.keyActivities);
    const manualActivityItems = splitDelimited(stage.manualActivities ?? null);
    const automationOpportunityItems = splitDelimited(stage.automationOpportunities ?? null);
    const actorItems = splitDelimited(stage.primaryActors);
    const inputItems = splitDelimited(stage.inputs);
    const outputItems = splitDelimited(stage.outputs);

    console.debug("[ProcessStageDrawer] stage data:", {
        id: stage.id,
        stepName: stage.stepName,
        businessPurpose: stage.businessPurpose,
        keyActivities: stage.keyActivities,
        primaryActors: stage.primaryActors,
        inputs: stage.inputs,
        outputs: stage.outputs,
        riskNotes: stage.riskNotes,
    });

    return (
        <div className="pv-drawer" onClick={e => e.stopPropagation()}>
            <div className="pv-drawer-inner">
                <div className="pv-drawer-hdr">
                    <div className="pv-drawer-hdr-top">
                        <span className="pv-drawer-label">Process Stage</span>
                        <button className="pv-drawer-close" onClick={onClose} title="Close drawer" aria-label="Close">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                        </button>
                    </div>
                    <div className="pv-drawer-hdr-main">
                        <span className="pv-stage-num">{stage.sequenceOrder}</span>
                        <div>
                            <h2 className="pv-drawer-title">{stage.stepName}</h2>
                            {actor && <ProcessActorBadge label={actor} />}
                        </div>
                    </div>
                </div>

                <DrawerSection title="Business Purpose">
                    <p className="pv-drawer-text">{businessPurpose || "No purpose documented yet."}</p>
                </DrawerSection>

                {stage.keyActivities && (
                    <DrawerSection title="Key Activities">
                        {keyActivityItems.length > 0 ? (
                            <DrawerBulletList items={keyActivityItems} />
                        ) : (
                            <p className="pv-drawer-text">{stage.keyActivities}</p>
                        )}
                    </DrawerSection>
                )}

                {stage.manualActivities && (
                    <DrawerSection title="Manual Activities">
                        {manualActivityItems.length > 0 ? (
                            <DrawerBulletList items={manualActivityItems} />
                        ) : (
                            <p className="pv-drawer-text">{stage.manualActivities}</p>
                        )}
                    </DrawerSection>
                )}

                {stage.automationOpportunities && (
                    <DrawerSection title="Automation Opportunities">
                        {automationOpportunityItems.length > 0 ? (
                            <DrawerBulletList items={automationOpportunityItems} />
                        ) : (
                            <p className="pv-drawer-text">{stage.automationOpportunities}</p>
                        )}
                    </DrawerSection>
                )}

                {stage.primaryActors && (
                    <DrawerSection title="Primary Actors">
                        {actorItems.length > 0 ? (
                            <DrawerPillList items={actorItems} />
                        ) : (
                            <p className="pv-drawer-text">{stage.primaryActors}</p>
                        )}
                    </DrawerSection>
                )}

                {stage.inputs && (
                    <DrawerSection title="Inputs">
                        {inputItems.length > 0 ? (
                            <DrawerBulletList items={inputItems} />
                        ) : (
                            <p className="pv-drawer-text">{stage.inputs}</p>
                        )}
                    </DrawerSection>
                )}

                {stage.outputs && (
                    <DrawerSection title="Outputs">
                        {outputItems.length > 0 ? (
                            <DrawerBulletList items={outputItems} />
                        ) : (
                            <p className="pv-drawer-text">{stage.outputs}</p>
                        )}
                    </DrawerSection>
                )}

                <DrawerSection title="Systems Involved" count={stage.systems.length}>
                    {stage.systems.length === 0 ? (
                        <p className="pv-drawer-empty">No systems mapped to this stage.</p>
                    ) : (
                        <div className="pv-drawer-systems">
                            {stage.systems.map(sys => (
                                <ProcessDrawerSystemCard key={sys.mappingId} system={sys} />
                            ))}
                        </div>
                    )}
                </DrawerSection>

                <DrawerSection
                    title="Related Integrations"
                    count={stage.relatedIntegrations?.length ?? 0}
                >
                    {stage.relatedIntegrations && stage.relatedIntegrations.length > 0 ? (
                        <div className="pv-drawer-integrations">
                            {stage.relatedIntegrations.map(int => (
                                <ProcessDrawerIntegrationCard key={int.integrationId} integration={int} />
                            ))}
                        </div>
                    ) : (
                        <p className="pv-drawer-empty">No related integrations documented for this stage yet.</p>
                    )}
                </DrawerSection>

                <DrawerSection title="Risks / Impacts">
                    {stage.riskNotes ? (
                        <p className="pv-drawer-text">{stage.riskNotes}</p>
                    ) : (
                        <p className="pv-drawer-empty">No risks or impacts documented yet.</p>
                    )}
                </DrawerSection>


            </div>
        </div>
    );
}
