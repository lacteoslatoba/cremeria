import { AdminLayout } from "@/components/layout/admin-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        // We override globals.css styling issues by wrapping admin globally
        <div className="admin-container !bg-[#f8f9fa] !text-slate-800">
            <AdminLayout>
                {children}
            </AdminLayout>
        </div>
    );
}
