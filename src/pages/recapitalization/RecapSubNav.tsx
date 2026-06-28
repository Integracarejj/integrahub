import { useNavigate, useLocation } from "react-router-dom";

const NAV_ITEMS = [
    { label: "Overview", path: "/recapitalization" },
    { label: "Intake Queue", path: "/recapitalization/intake" },
    { label: "Work Queue", path: "/recapitalization/tracker" },
    { label: "My Work", path: "/recapitalization/my-work" },
    { label: "Documents", path: "/recapitalization/documents" },
    { label: "Reports", path: "/recapitalization/reports" },
    { label: "Settings", path: "/recapitalization/settings" },
];

export default function RecapSubNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === "/recapitalization") {
            return location.pathname === "/recapitalization";
        }
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="rc-subnav">
            {NAV_ITEMS.map((item) => (
                <button
                    key={item.path}
                    className={`rc-subnav-btn${isActive(item.path) ? " rc-subnav-active" : ""}`}
                    onClick={() => navigate(item.path)}
                >
                    {item.label}
                </button>
            ))}
        </nav>
    );
}
