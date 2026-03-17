import { NavLink } from 'react-router-dom';

export default function HiringInterviewTabs({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    const tabs = [
        { label: 'Interviews', path: '/hiring/interviews', end: true },
        {
            label: 'Interview Schedule (Cal.com)',
            path: '/hiring/interviews/schedule',
            end: false,
        },
    ];

    return (
        <div className="mb-6">
            <h1
                className="text-2xl font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
            >
                {title}
            </h1>
            <p
                className="text-sm mt-1"
                style={{ color: 'var(--color-text-secondary)' }}
            >
                {description}
            </p>

            <div
                className="mt-4 inline-flex gap-2 rounded-xl border p-1"
                style={{
                    borderColor: 'var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                }}
            >
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={tab.path}
                        end={tab.end}
                        className={({ isActive }) =>
                            `px-4 py-2 text-sm rounded-lg transition-colors ${isActive ? 'font-semibold' : 'font-medium'}`
                        }
                        style={({ isActive }) => ({
                            backgroundColor: isActive
                                ? 'var(--color-primary-soft)'
                                : 'transparent',
                            color: isActive
                                ? 'var(--color-primary-dark)'
                                : 'var(--color-text-secondary)',
                        })}
                    >
                        {tab.label}
                    </NavLink>
                ))}
            </div>
        </div>
    );
}
