import { useEffect, useMemo, useState } from "react";
import type { RoleDefinition, SystemRoleUsageRecord, RoleUsageFormData } from "../../types/role";
import { getRoleDefinitions, getRoleUsageByRole, createRoleUsage, updateRoleUsage, deleteRoleUsage } from "../../services/roleService";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import "./RoleView.css";

interface ApplicationOption {
    id: string;
    name: string;
}

const USAGE_TYPE_OPTIONS = ["Primary", "Secondary", "Reporting / Visibility", "Administrative", "Occasional"];

const USAGE_TYPE_LABELS: Record<string, string> = {
    "Primary": "Primary Usage",
    "Secondary": "Secondary Usage",
    "Reporting / Visibility": "Reporting / Visibility",
    "Administrative": "Administrative",
    "Occasional": "Occasional",
};

const EMPTY_ADMIN_FORM: RoleUsageFormData = {
    applicationId: "",
    roleDefinitionId: "",
    usageType: "Primary",
    usagePurpose: "",
    isPrimary: false,
    notes: "",
};

export default function RoleView() {
    const { permissions } = usePermissions();
    const isAdmin = isPlatformAdmin(permissions);

    const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
    const [selectedRoleCode, setSelectedRoleCode] = useState("");
    const [roleUsage, setRoleUsage] = useState<SystemRoleUsageRecord[]>([]);
    const [applications, setApplications] = useState<ApplicationOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [usageLoading, setUsageLoading] = useState(false);

    const [showAdmin, setShowAdmin] = useState(false);
    const [adminForm, setAdminForm] = useState<RoleUsageFormData>({ ...EMPTY_ADMIN_FORM });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const roles = await getRoleDefinitions();
                if (mounted) setRoleDefinitions(roles);
            } catch {
                // silently fail
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        fetch("/api/applications")
            .then((res) => res.json())
            .then((data) => {
                if (mounted) setApplications(data);
            })
            .catch(() => {
                if (mounted) setApplications([]);
            });

        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!selectedRoleCode) {
            setRoleUsage([]);
            return;
        }
        let mounted = true;
        setUsageLoading(true);
        (async () => {
            try {
                const data = await getRoleUsageByRole(selectedRoleCode);
                if (mounted) setRoleUsage(data);
            } catch {
                if (mounted) setRoleUsage([]);
            } finally {
                if (mounted) setUsageLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [selectedRoleCode]);

    const selectedRole = useMemo(
        () => roleDefinitions.find((r) => r.roleCode === selectedRoleCode) || null,
        [roleDefinitions, selectedRoleCode]
    );

    const usageByType = useMemo(() => {
        const map = new Map<string, SystemRoleUsageRecord[]>();
        USAGE_TYPE_OPTIONS.forEach((t) => map.set(t, []));
        roleUsage.forEach((r) => {
            const list = map.get(r.usageType);
            if (list) list.push(r);
        });
        return map;
    }, [roleUsage]);

    const usageCount = roleUsage.length;
    const primaryCount = roleUsage.filter((r) => r.isPrimary).length;

    const appOptions = applications
        .filter((a) => a.id && a.name)
        .sort((a, b) => a.name.localeCompare(b.name));

    function handleRoleChange(code: string) {
        setSelectedRoleCode(code);
        setShowAdmin(false);
        setAdminForm({ ...EMPTY_ADMIN_FORM });
        setEditingId(null);
        setMessage(null);
    }

    function openAddForm() {
        if (!selectedRole) return;
        setAdminForm({
            ...EMPTY_ADMIN_FORM,
            roleDefinitionId: selectedRole.id,
        });
        setEditingId(null);
        setShowAdmin(true);
        setMessage(null);
    }

    function openEditForm(record: SystemRoleUsageRecord) {
        setAdminForm({
            applicationId: record.applicationId,
            roleDefinitionId: record.roleDefinitionId,
            usageType: record.usageType,
            usagePurpose: record.usagePurpose || "",
            isPrimary: record.isPrimary,
            notes: record.notes || "",
        });
        setEditingId(record.id);
        setShowAdmin(true);
        setMessage(null);
    }

    function cancelAdmin() {
        setShowAdmin(false);
        setAdminForm({ ...EMPTY_ADMIN_FORM });
        setEditingId(null);
        setMessage(null);
    }

    async function handleAdminSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedRole) return;
        if (!adminForm.applicationId) {
            setMessage({ type: "error", text: "Please select a system" });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const data = {
                ...adminForm,
                roleDefinitionId: selectedRole.id,
            };

            if (editingId) {
                await updateRoleUsage(editingId, data);
                setMessage({ type: "success", text: "Role usage updated successfully" });
            } else {
                await createRoleUsage(data);
                setMessage({ type: "success", text: "Role usage added successfully" });
            }

            const updated = await getRoleUsageByRole(selectedRoleCode);
            setRoleUsage(updated);
            setAdminForm({ ...EMPTY_ADMIN_FORM, roleDefinitionId: selectedRole.id });
            setEditingId(null);
        } catch (err) {
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Operation failed",
            });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!window.confirm("Are you sure you want to remove this role mapping?")) return;

        try {
            await deleteRoleUsage(id);
            setMessage({ type: "success", text: "Role usage removed successfully" });
            const updated = await getRoleUsageByRole(selectedRoleCode);
            setRoleUsage(updated);
        } catch (err) {
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to delete",
            });
        }
    }

    function getAppName(applicationId: string): string {
        return appOptions.find((a) => a.id === applicationId)?.name || applicationId;
    }

    if (loading) {
        return <p className="role-loading">Loading roles…</p>;
    }

    return (
        <div className="role-view">
            {message && (
                <div className={`role-msg role-msg-${message.type}`}>{message.text}</div>
            )}

            <div className="role-controls">
                <label htmlFor="role-select">Role:</label>
                <select
                    id="role-select"
                    value={selectedRoleCode}
                    onChange={(e) => handleRoleChange(e.target.value)}
                >
                    <option value="">Select a role…</option>
                    {roleDefinitions.map((r) => (
                        <option key={r.id} value={r.roleCode}>
                            {r.roleCode} — {r.roleName} ({r.roleGroup})
                        </option>
                    ))}
                </select>
            </div>

            {!selectedRoleCode && (
                <div className="role-empty">
                    <div className="role-empty-icon">🎯</div>
                    <h2>Role View</h2>
                    <p>
                        Select a role above to see which systems are used to perform it,
                        grouped by usage type. This view helps you understand how roles
                        map to the technology landscape.
                    </p>
                    <div className="role-empty-stats">
                        <div className="role-empty-stat">
                            <span className="role-empty-stat-num">{roleDefinitions.length}</span>
                            <span className="role-empty-stat-label">Roles</span>
                        </div>
                        <div className="role-empty-stat">
                            <span className="role-empty-stat-num">{USAGE_TYPE_OPTIONS.length}</span>
                            <span className="role-empty-stat-label">Usage Types</span>
                        </div>
                    </div>
                </div>
            )}

            {selectedRoleCode && usageLoading && (
                <p className="role-loading">Loading role usage…</p>
            )}

            {selectedRoleCode && !usageLoading && roleUsage.length === 0 && (
                <div className="role-empty">
                    <div className="role-empty-icon">📋</div>
                    <h2>{selectedRole?.roleCode} — {selectedRole?.roleName}</h2>
                    <p>
                        No systems have been mapped to this role yet.{" "}
                        {isAdmin
                            ? "Use the admin section below to add system mappings."
                            : "Contact an administrator to add system mappings for this role."}
                    </p>
                    {selectedRole?.description && (
                        <p className="role-desc">{selectedRole.description}</p>
                    )}
                </div>
            )}

            {selectedRoleCode && !usageLoading && roleUsage.length > 0 && (
                <>
                    <div className="role-summary">
                        <div className="role-summary-item">
                            <span className="role-summary-num">{usageCount}</span>
                            <span className="role-summary-label">Systems mapped to {selectedRole?.roleCode}</span>
                        </div>
                        <div className="role-summary-item">
                            <span className="role-summary-num">{primaryCount}</span>
                            <span className="role-summary-label">Primary systems</span>
                        </div>
                        {selectedRole?.description && (
                            <span className="role-summary-desc">{selectedRole.description}</span>
                        )}
                    </div>

                    {USAGE_TYPE_OPTIONS.filter((t) => (usageByType.get(t)?.length || 0) > 0).map((type) => {
                        const items = usageByType.get(type) || [];
                        return (
                            <div key={type} className="role-usage-group">
                                <h3 className="role-usage-group-title">
                                    {USAGE_TYPE_LABELS[type]}
                                    <span className="role-usage-count">{items.length}</span>
                                </h3>
                                <div className="role-system-cards">
                                    {items.map((item) => (
                                        <div key={item.id} className="role-system-card">
                                            <div className="role-system-card-header">
                                                <span className="role-system-card-name">
                                                    {item.applicationName}
                                                </span>
                                                {item.isPrimary && (
                                                    <span className="role-primary-badge">Primary</span>
                                                )}
                                            </div>
                                            <div className="role-system-card-meta">
                                                {item.applicationType && (
                                                    <span className="role-system-tag">{item.applicationType}</span>
                                                )}
                                                {item.systemCategory && (
                                                    <span className="role-system-tag">{item.systemCategory}</span>
                                                )}
                                                {item.applicationStatus && (
                                                    <span className={`role-system-tag role-status-${item.applicationStatus.toLowerCase()}`}>
                                                        {item.applicationStatus}
                                                    </span>
                                                )}
                                            </div>
                                            {item.usagePurpose && (
                                                <p className="role-system-purpose">{item.usagePurpose}</p>
                                            )}
                                            {item.notes && (
                                                <p className="role-system-notes">{item.notes}</p>
                                            )}
                                            {isAdmin && (
                                                <div className="role-system-actions">
                                                    <button
                                                        className="role-action-btn"
                                                        onClick={() => openEditForm(item)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="role-action-btn role-action-delete"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            {selectedRoleCode && isAdmin && (
                <div className="role-admin-section">
                    {!showAdmin ? (
                        <button className="btn btn-primary" onClick={openAddForm}>
                            + Add System Mapping
                        </button>
                    ) : (
                        <form className="role-admin-form" onSubmit={handleAdminSubmit}>
                            <h3>{editingId ? "Edit System Mapping" : "Add System Mapping"}</h3>

                            <div className="role-admin-form-grid">
                                <div className="role-form-field">
                                    <label>System <span className="required">*</span></label>
                                    <select
                                        value={adminForm.applicationId}
                                        onChange={(e) =>
                                            setAdminForm((f) => ({ ...f, applicationId: e.target.value }))
                                        }
                                    >
                                        <option value="">Select system…</option>
                                        {appOptions.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="role-form-field">
                                    <label>Usage Type <span className="required">*</span></label>
                                    <select
                                        value={adminForm.usageType}
                                        onChange={(e) =>
                                            setAdminForm((f) => ({ ...f, usageType: e.target.value }))
                                        }
                                    >
                                        {USAGE_TYPE_OPTIONS.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="role-form-field">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={adminForm.isPrimary}
                                            onChange={(e) =>
                                                setAdminForm((f) => ({ ...f, isPrimary: e.target.checked }))
                                            }
                                        />
                                        {" "}Primary system for this role
                                    </label>
                                </div>

                                <div className="role-form-field">
                                    <label>Purpose</label>
                                    <input
                                        type="text"
                                        value={adminForm.usagePurpose}
                                        onChange={(e) =>
                                            setAdminForm((f) => ({ ...f, usagePurpose: e.target.value }))
                                        }
                                        placeholder="Why is this system used for this role?"
                                    />
                                </div>

                                <div className="role-form-field role-form-field-full">
                                    <label>Notes</label>
                                    <textarea
                                        value={adminForm.notes}
                                        onChange={(e) =>
                                            setAdminForm((f) => ({ ...f, notes: e.target.value }))
                                        }
                                        rows={2}
                                        placeholder="Optional notes about this mapping"
                                    />
                                </div>
                            </div>

                            <div className="role-admin-form-actions">
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? "Saving…" : editingId ? "Update Mapping" : "Add Mapping"}
                                </button>
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={cancelAdmin}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
