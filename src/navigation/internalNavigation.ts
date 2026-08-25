export interface InternalNavigationItem {
    to: string;
    label: string;
    icon: string;
    end?: boolean;
}

export const INTERNAL_NAV_ITEMS: readonly InternalNavigationItem[] = Object.freeze([
    { to: "/", label: "Home", icon: "🏠", end: true },
    { to: "/topics", label: "Business Topics", icon: "🧭" },
    { to: "/applications", label: "Systems", icon: "🖥️" },
    { to: "/processes", label: "Processes", icon: "🔄" },
    { to: "/performance", label: "Performance", icon: "📈" },
    { to: "/integrations", label: "Explore", icon: "🗺️" },
    { to: "/recapitalization", label: "Recapitalization", icon: "💼" },
    { to: "/documents", label: "Document Hub", icon: "📄" },
]);
