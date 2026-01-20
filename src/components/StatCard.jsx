
export function StatCard({ title, value, icon: Icon, color = "primary" }) {
    const colorClasses = {
        primary: "bg-blue-50 dark:bg-blue-900/20 text-primary",
        success: "bg-green-50 dark:bg-green-900/20 text-secondary",
        warning: "bg-orange-50 dark:bg-orange-900/20 text-orange-500",
        error: "bg-red-50 dark:bg-red-900/20 text-danger"
    }

    const selectedClass = colorClasses[color] || colorClasses.primary

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-soft flex items-center gap-4 border border-border-light dark:border-border-dark transition-all duration-300">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${selectedClass}`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark transition-colors uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-bold text-text-primary-light dark:text-white transition-colors">{value}</p>
            </div>
        </div>
    )
}
