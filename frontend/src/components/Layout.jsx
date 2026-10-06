import { Compass, FileText, LogOut, MessageSquare, Target } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Resume & jobs', icon: FileText, end: true },
  { to: '/skill-gap', label: 'Skill gap analysis', icon: Target },
  { to: '/assistant', label: 'Career assistant', icon: MessageSquare },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white"><Compass className="h-5 w-5" /></div>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight">Career Intelligence</div>
        <div className="text-[11px] font-medium opacity-60">Job matching & guidance</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink px-4 py-5 text-white lg:flex">
        <Brand />
        <nav className="mt-8 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
              <Icon className="h-[18px] w-[18px]" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold">{user?.name?.[0]?.toUpperCase() || '?'}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user?.name}</div>
            <div className="truncate text-xs text-white/55">{user?.email}</div>
          </div>
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-ink text-white lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <button onClick={logout} aria-label="Sign out" className="rounded-md p-2 text-white/70 hover:bg-white/10"><LogOut className="h-4 w-4" /></button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${isActive ? 'bg-white/15' : 'text-white/65'}`}>
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
