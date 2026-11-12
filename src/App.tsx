import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Award, BarChart3,
  BookOpen, BriefcaseBusiness, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp,
  Clock3, Code2, Copy, Download, ExternalLink, FileText, Flame, GraduationCap, House,
  Layers3, ListChecks, LoaderCircle, LockKeyhole, Menu, MessageSquareText, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, Send, Sparkles, Target, Trophy, Upload, UserRound, Users, X, Zap,
} from 'lucide-react'
import { challenges, modules, opportunities, resources, roles, skills } from './data'
import { arenaCategories, arenaTopics, arenaXpReward } from './arenaData'
import { evaluateAnswer } from './services/evaluate'
import { loadState, resetState, saveState } from './services/storage'
import { learningRequest, learningSignIn, learningSignOut, learningRegister, learningCurrentUser, learningClearSession, learningForgotPassword, learningUpdatePassword, type LearningResource, type Roadmap } from './services/learningApi'
import { filterLearningResources } from './services/learningFilters'
import { readResumePdf } from './services/resumePdf'
import type { Application, ApplicationStatus, Attempt, Challenge, DemoState, Evaluation, Opportunity, Resource, Role, RoadmapModule } from './types'

type View = 'dashboard' | 'explore' | 'role' | 'learn' | 'lesson' | 'practice' | 'results' | 'arena' | 'opportunities' | 'opportunity' | 'resume' | 'applications'

const nav = [
  { id: 'dashboard' as View, label: 'Dashboard', icon: House },
  { id: 'explore' as View, label: 'Explore roles', icon: Search },
  { id: 'learn' as View, label: 'Learn', icon: BookOpen },
  { id: 'arena' as View, label: 'Arena', icon: Trophy },
  { id: 'opportunities' as View, label: 'Opportunities', icon: BriefcaseBusiness },
  { id: 'resume' as View, label: 'Resume Studio', icon: FileText },
  { id: 'applications' as View, label: 'Applications', icon: ListChecks },
]

const initials = 'DL'
const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
const isPasswordRecoveryLink = () => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'

function App() {
  const [state, setState] = useState<DemoState>(() => loadState())
  const [view, setView] = useState<View>(() => isPasswordRecoveryLink() ? 'learn' : 'dashboard')
  const [practiceReturnView, setPracticeReturnView] = useState<View>('lesson')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedModuleId, setSelectedModuleId] = useState('react-components')
  const [selectedChallengeId, setSelectedChallengeId] = useState('react-list')
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('intern-frontend')
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null)
  const [toast, setToast] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('bhumika-sidebar-collapsed') === 'true')
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('bhumika-onboarding-complete') !== 'true')
  const [onboardingRole, setOnboardingRole] = useState(state.activeRoleId)
  const [onboardingLevel, setOnboardingLevel] = useState('Getting started')

  useEffect(() => { saveState(state) }, [state])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('challenge')
    const task = params.get('task')
    if (code) { setInviteCode(code.toUpperCase()); setView('arena') }
    if (task && challenges.some((item) => item.id === task)) setSelectedChallengeId(task)
  }, [])
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInputRef.current?.focus(); setSearchOpen(true) }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeRole = roles.find((role) => role.id === state.activeRoleId) ?? roles[0]
  const selectedModule = modules.find((item) => item.id === selectedModuleId) ?? modules[2]
  const selectedChallenge = challenges.find((item) => item.id === selectedChallengeId) ?? challenges[2]
  const selectedOpportunity = opportunities.find((item) => item.id === selectedOpportunityId) ?? opportunities[0]
  const roleModules = useMemo(() => modules.filter((item) => item.roleId === activeRole.id), [activeRole.id])
  const roleAttempts = state.attempts.filter((attempt) => attempt.roleId === activeRole.id)

  function update(patch: Partial<DemoState>) { setState((current) => ({ ...current, ...patch })) }
  function go(next: View) { setView(next); setSearchOpen(false); setMobileNavOpen(false) }
  function showRole(role: Role) { update({ activeRoleId: role.id }); go('role') }
  function openLesson(item: RoadmapModule) { setSelectedModuleId(item.id); setSelectedChallengeId(item.challengeId); go('lesson') }
  function startModulePractice(item: RoadmapModule) { setSelectedModuleId(item.id); setSelectedChallengeId(item.challengeId); setPracticeReturnView('lesson'); go('practice') }
  function openOpportunity(item: Opportunity) { setSelectedOpportunityId(item.id); go('opportunity') }
  function resetDemo() {
    setState(resetState()); setEvaluation(null); setLastAttempt(null); setInviteCode(''); setSearch(''); window.history.replaceState({}, '', window.location.pathname); go('dashboard'); setToast('Demo data reset')
  }

  const suggestions = [...roles.map((item) => ({ label: item.title, role: item })), ...skills.map((item) => ({ label: item.name, role: roles.find((r) => r.skillIds.includes(item.id)) ?? roles[0] }))]
    .filter((item) => search && item.label.toLowerCase().includes(search.toLowerCase())).slice(0, 5)

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <button className="brand-lockup" onClick={() => go('dashboard')} aria-label="Bhūmikā dashboard">
          <span className="brand-symbol"><span /><span /><span /></span><span className="brand-name">bhūmikā<span className="brand-dot">.</span></span>
        </button>
        <button className="sidebar-collapse" aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setSidebarCollapsed((value) => { localStorage.setItem('bhumika-sidebar-collapsed', String(!value)); return !value })}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {nav.map((item) => {
            const Icon = item.icon
            const active = view === item.id || (item.id === 'explore' && view === 'role') || (item.id === 'learn' && ['lesson', 'practice', 'results'].includes(view)) || (item.id === 'opportunities' && view === 'opportunity')
            return <button key={item.id} className={`nav-item ${active ? 'active' : ''}`} title={sidebarCollapsed ? item.label : undefined} aria-label={sidebarCollapsed ? item.label : undefined} onClick={() => go(item.id)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'applications' && state.applications.length > 0 && <span className="nav-count">{state.applications.length}</span>}</button>
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="streak-card"><div className="streak-icon"><Flame size={16} fill="currentColor" /></div><div><strong>{state.streak ? `${state.streak} day streak` : 'Start a streak'}</strong><span>{state.streak ? 'Small steps add up.' : 'One practice at a time.'}</span></div><ChevronRight size={15} /></div>
        <button className="reset-link" onClick={resetDemo}><RotateCcw size={14} /> Reset demo data</button>
        <button className="profile-mini" onClick={() => go('resume')}><span className="avatar">{initials}</span><span><strong>Demo learner</strong><small>Local profile</small></span><MoreHorizontal size={17} className="profile-more" /></button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(!mobileNavOpen)}><Menu size={19} /></button>
          <div className="topbar-context"><span>Workspace</span><ChevronRight size={13} /><strong>{nav.find((item) => item.id === (view === 'role' ? 'explore' : ['lesson', 'practice', 'results'].includes(view) ? 'learn' : view === 'opportunity' ? 'opportunities' : view))?.label ?? 'Dashboard'}</strong></div>
          <div className="topbar-actions">
            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input ref={searchInputRef} aria-label="Search roles and skills" placeholder="Search roles or skills..." value={search} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' && suggestions[0]) showRole(suggestions[0].role); if (event.key === 'Escape') setSearchOpen(false) }} />
              <kbd>⌘ K</kbd>
              {searchOpen && search && <div className="search-popover">{suggestions.length ? suggestions.map((item, index) => <button key={`${item.label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { showRole(item.role); setSearch(item.label) }}><span className="search-result-icon"><Search size={14} /></span><span>{item.label}<small>{item.role.title}</small></span><ArrowUpRight size={14} /></button>) : <div className="search-empty">No role or skill found. Try React or SQL.</div>}</div>}
            </div>
            <button className="icon-button help-button" aria-label="Help" onClick={() => setToast('Bhūmikā demo · Your progress is saved on this device.')}><CircleHelp size={18} /></button>
            <button className="top-avatar" onClick={() => go('resume')} aria-label="Open profile">{initials}</button>
          </div>
        </header>

        <div className="page-wrap">
          {view === 'dashboard' && <Dashboard state={state} role={activeRole} modules={roleModules} attempts={roleAttempts} onContinue={() => openLesson(roleModules.find((item) => !state.completedModuleIds.includes(item.id)) ?? roleModules[0])} onChallenge={() => { const challengeId = activeRole.id === 'frontend' ? 'react-list' : 'sql-aggregation'; const related = modules.find((item) => item.challengeId === challengeId); if (related) setSelectedModuleId(related.id); setSelectedChallengeId(challengeId); setPracticeReturnView('dashboard'); go('practice') }} onRole={() => go('role')} onOpportunities={() => go('opportunities')} onOpenOpportunity={openOpportunity} onArena={() => go('arena')} onExplore={() => go('explore')} />}
          {view === 'explore' && <Explore activeRole={activeRole} onOpenRole={showRole} />}
          {view === 'role' && <RoleDetail role={activeRole} state={state} onBack={() => go('explore')} onStart={() => openLesson(roleModules.find((item) => !state.completedModuleIds.includes(item.id)) ?? roleModules[0])} onOpenLesson={openLesson} />}
          {view === 'learn' && <Learn role={activeRole} state={state} onRoleChange={(roleId) => update({ activeRoleId: roleId })} onOpenLesson={openLesson} onPractice={startModulePractice} />}
          {view === 'lesson' && <Lesson role={activeRole} item={selectedModule} state={state} onBack={() => go('learn')} onPractice={() => startModulePractice(selectedModule)} />}
          {view === 'practice' && <Practice role={activeRole} challenge={selectedChallenge} onBack={() => go(practiceReturnView)} onSubmit={(answer) => {
            const timedOut = answer.startsWith('Timed submission: ')
            const submittedAnswer = timedOut ? answer.slice('Timed submission: '.length) : answer
            if (submittedAnswer.trim().length < 8 && !timedOut) { setToast('Add a little more detail before submitting.'); return }
            const result = evaluateAnswer(selectedChallenge, submittedAnswer)
            const isFirstAttempt = !state.attempts.some((entry) => entry.challengeId === selectedChallenge.id)
            const reward = isFirstAttempt ? arenaXpReward : 0
            const attempt: Attempt = { id: `${Date.now()}`, challengeId: selectedChallenge.id, roleId: selectedChallenge.roleId, answer: submittedAnswer.trim(), score: result.score, completedAt: new Date().toISOString(), xp: reward, evaluation: result }
            const moduleForChallenge = modules.find((item) => item.challengeId === selectedChallenge.id)
            setState((current) => ({ ...current, xp: current.xp + reward, streak: current.streak || 1, attempts: [attempt, ...current.attempts], completedModuleIds: moduleForChallenge && !current.completedModuleIds.includes(moduleForChallenge.id) ? [...current.completedModuleIds, moduleForChallenge.id] : current.completedModuleIds }))
            setEvaluation(result); setLastAttempt(attempt); go('results')
          }} />}
          {view === 'results' && evaluation && <Results role={activeRole} challenge={selectedChallenge} evaluation={evaluation} attempt={lastAttempt} onBack={() => go('learn')} onNext={() => { const next = challenges.filter((item) => item.skillId === selectedChallenge.skillId && item.id !== selectedChallenge.id).sort((a, b) => state.attempts.filter((attempt) => attempt.challengeId === a.id).length - state.attempts.filter((attempt) => attempt.challengeId === b.id).length)[0] ?? challenges.find((item) => item.id !== selectedChallenge.id) ?? selectedChallenge; setSelectedChallengeId(next.id); go('practice') }} onProgress={() => go('dashboard')} />}
          {view === 'results' && !evaluation && <EmptyState title="No feedback to show yet" body="Complete a practice activity to see your rubric feedback." action="Go to learning" onAction={() => go('learn')} />}
          {view === 'arena' && <Arena state={state} onChallenge={(id) => { const challenge = challenges.find((item) => item.id === id); if (challenge) update({ activeRoleId: challenge.roleId }); const related = modules.find((item) => item.challengeId === id); if (related) setSelectedModuleId(related.id); setSelectedChallengeId(id); setPracticeReturnView('arena'); go('practice') }} onCreate={(code, id) => { update({ arenaChallenges: [{ code, challengeId: id, createdAt: new Date().toISOString() }, ...state.arenaChallenges] }); setInviteCode(code); setToast('Local invite link created') }} onFriendResult={(code, score) => update({ arenaChallenges: state.arenaChallenges.map((item) => item.code === code ? { ...item, friendScore: score } : item) })} inviteCode={inviteCode} onClearInvite={() => { setInviteCode(''); window.history.replaceState({}, '', window.location.pathname) }} />}
          {view === 'opportunities' && <OpportunitiesPage onOpen={openOpportunity} onResume={(item) => { setSelectedOpportunityId(item.id); go('resume') }} />}
          {view === 'opportunity' && <OpportunityDetail item={selectedOpportunity} onBack={() => go('opportunities')} onPrepare={() => go('resume')} />}
          {view === 'resume' && <ResumeStudio state={state} opportunity={selectedOpportunity} onProfileChange={(profile) => update({ profile })} onSaveApplication={(application) => { update({ applications: [application, ...state.applications] }); go('applications'); setToast('Draft added to your application tracker') }} />}
          {view === 'applications' && <Applications state={state} onStatus={(id, status) => {
            if (status === 'Applied' && !window.confirm('Confirm you have submitted this application? Bhūmikā will not send it for you.')) return
            update({ applications: state.applications.map((app) => app.id === id ? { ...app, status, updatedAt: new Date().toISOString() } : app) })
          }} onPrepare={() => go('resume')} />}
        </div>
        <footer className="app-footer"><span>Bhūmikā · Your next step, made clear.</span><span><LockKeyhole size={12} /> Your demo progress stays on this device</span></footer>
      </main>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><X size={15} /></button></div>}
      {showOnboarding && <div className="onboarding-backdrop"><section className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><button className="onboarding-skip" onClick={() => { localStorage.setItem('bhumika-onboarding-complete', 'true'); setShowOnboarding(false) }}>Skip for now</button><span className="onboarding-mark"><Sparkles size={20} /></span><div className="eyebrow">A CLEARER WAY TO GET READY</div><h2 id="onboarding-title">Welcome to Bhūmikā.</h2><p>Pick a role to make your starting dashboard personal. You can switch paths whenever you like.</p><label className="field-label">What role are you exploring?<select value={onboardingRole} onChange={(event) => setOnboardingRole(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select></label><label className="field-label">Where are you starting from?<select value={onboardingLevel} onChange={(event) => setOnboardingLevel(event.target.value)}><option>Getting started</option><option>Some experience</option><option>Building on what I know</option></select></label><div className="onboarding-note"><CheckCircle2 size={15} /> Short lessons, practical challenges, and progress saved on this device.</div><Button onClick={() => { update({ activeRoleId: onboardingRole }); localStorage.setItem('bhumika-onboarding-complete', 'true'); setShowOnboarding(false); setToast(`Your ${roles.find((role) => role.id === onboardingRole)?.title} path is ready`) }}>Show my starting path <ArrowRight size={15} /></Button></section></div>}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>
}

function Button({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button', title }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'outline'; className?: string; disabled?: boolean; type?: 'button' | 'submit'; title?: string }) {
  return <button type={type} disabled={disabled} title={title} className={`btn btn-${variant} ${className}`} onClick={onClick}>{children}</button>
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'teal' | 'amber' | 'blue' }) { return <span className={`pill pill-${tone}`}>{children}</span> }

function ProgressBar({ value, tone = 'teal' }: { value: number; tone?: 'teal' | 'amber' | 'blue' }) { return <div className={`progress-track progress-${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div> }

function Dashboard({ state, role, modules: items, attempts, onContinue, onChallenge, onRole, onOpportunities, onOpenOpportunity, onArena, onExplore }: {
  state: DemoState; role: Role; modules: RoadmapModule[]; attempts: Attempt[]; onContinue: () => void; onChallenge: () => void; onRole: () => void; onOpportunities: () => void; onOpenOpportunity: (item: Opportunity) => void; onArena: () => void; onExplore: () => void
}) {
  const nextModule = items.find((item) => !state.completedModuleIds.includes(item.id)) ?? items[0]
  const percent = Math.round((state.completedModuleIds.filter((id) => items.some((item) => item.id === id)).length / items.length) * 100)
  const progressBySkill = role.skillIds.map((skillId) => {
    const skill = skills.find((item) => item.id === skillId)!
    const scores = attempts.filter((attempt) => challenges.find((item) => item.id === attempt.challengeId)?.skillId === skillId).map((attempt) => attempt.score)
    return { skill, level: scores.length ? Math.min(94, Math.round(35 + scores.reduce((a, b) => a + b, 0) / scores.length * .55)) : 0, count: scores.length }
  })
  return <>
    <div className="welcome-row"><div><div className="welcome-date">{dateLabel}</div><h1>Good morning, Learner <span className="wave">✦</span></h1><p>Learn a role. Prove your skills. Prepare your next application.</p></div><button className="quiet-link" onClick={onExplore}>Explore a new role <ArrowRight size={15} /></button></div>
    <section className="dashboard-hero">
      <div className="hero-copy"><div className="hero-kicker"><span className="hero-spark"><Sparkles size={14} /></span> YOUR PATHWAY <span className="hero-line" /></div><h2>Make progress on<br /><em>your own terms.</em></h2><p>You've started exploring your next chapter. Let's keep the momentum going.</p><div className="hero-actions"><Button onClick={onContinue}>Continue learning <ArrowRight size={15} /></Button><button className="hero-text-link" onClick={onRole}>View my roadmap <ArrowUpRight size={15} /></button></div></div>
      <div className="hero-art" aria-label="Career path illustration"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-sun" /><div className="art-land land-back" /><div className="art-land land-front" /><div className="art-path" /><div className="art-marker marker-one"><Check size={12} /></div><div className="art-marker marker-two"><Code2 size={13} /></div><div className="art-marker marker-three"><Target size={12} /></div><div className="art-flag"><ArrowUpRight size={14} /></div><span className="art-label">YOUR NEXT<br />MILESTONE</span></div>
      <div className="hero-bottom"><span><span className="hero-dot" /> CURRENT PATH</span><button onClick={onRole}>{role.title}<ChevronDown size={14} /></button><span className="hero-bottom-progress">{percent}% complete <span className="mini-progress"><i style={{ width: `${percent}%` }} /></span></span></div>
    </section>

    <div className="stat-grid">
      <div className="stat-card"><span className="stat-icon icon-teal"><Zap size={17} /></span><div><small>Total XP</small><strong>{state.xp.toLocaleString()} <span>XP</span></strong></div><span className="stat-detail positive"><ArrowUpRight size={13} /> Keep it up</span></div>
      <div className="stat-card"><span className="stat-icon icon-amber"><Flame size={17} /></span><div><small>Learning streak</small><strong>{state.streak} <span>days</span></strong></div><span className="stat-detail">A little each day</span></div>
      <div className="stat-card"><span className="stat-icon icon-lilac"><BookOpen size={17} /></span><div><small>Modules completed</small><strong>{state.completedModuleIds.length} <span>/ {items.length}</span></strong></div><span className="stat-detail">in your current path</span></div>
      <div className="stat-card"><span className="stat-icon icon-blue"><Activity size={17} /></span><div><small>Practice attempts</small><strong>{attempts.length}</strong></div><span className="stat-detail">Feedback builds skill</span></div>
    </div>

    <div className="section-heading"><div><h2>Your learning path</h2><p>Small, practical steps toward {role.title.toLowerCase()}.</p></div><button className="text-action" onClick={onRole}>View roadmap <ArrowRight size={14} /></button></div>
    <div className="dashboard-grid">
      <section className="card continue-card"><div className="card-topline"><span className="section-label"><BookOpen size={14} /> PICK UP WHERE YOU LEFT OFF</span><button className="more-button" aria-label="More learning options" onClick={onExplore}><MoreHorizontal size={18} /></button></div><div className="continue-body"><div className={`lesson-art ${role.id === 'analyst' ? 'lesson-art-data' : ''}`}><div className="lesson-art-orbit" /><div className="lesson-code-window"><span /><span /><span /><i /><b /><em /></div><div className="lesson-art-spark"><Sparkles size={17} /></div></div><div className="continue-copy"><div className="eyebrow">NEXT IN YOUR PATH</div><h3>{nextModule.title}</h3><p>{nextModule.subtitle}</p><div className="inline-meta"><span><Clock3 size={13} /> {nextModule.duration}</span><span className="meta-dot">·</span><span>Module {Math.max(1, items.indexOf(nextModule) + 1)} of {items.length}</span></div><Button onClick={onContinue} variant="secondary">Continue module <ArrowRight size={14} /></Button></div></div><div className="continue-footer"><div className="module-track">{items.map((item, index) => <span key={item.id} className={state.completedModuleIds.includes(item.id) ? 'done' : index === items.indexOf(nextModule) ? 'current' : ''} />)}</div><small>{percent}% pathway progress</small></div></section>
      <section className="card daily-card"><div className="card-topline"><span className="section-label"><Target size={14} /> DAILY PRACTICE</span><Pill tone="amber">5–8 min</Pill></div><div className="daily-illustration"><div className="daily-sun" /><div className="daily-shape shape-one" /><div className="daily-shape shape-two" /><div className="daily-check"><Target size={20} /></div><div className="daily-label">A SMALL<br />WIN TODAY</div></div><h3>Make it make sense.</h3><p>Try a realistic task and get feedback you can put to use right away.</p><Button onClick={onChallenge} variant="outline">Start a challenge <ArrowRight size={14} /></Button></section>
      <section className="card skills-card"><div className="card-topline"><div><div className="section-label"><BarChart3 size={14} /> YOUR SKILL MAP</div><h3 className="card-title">Skills in progress</h3></div><span className="estimate-tag">ESTIMATES</span></div><div className="skill-list">{progressBySkill.map((item) => <div className="skill-row" key={item.skill.id}><div className="skill-row-head"><span>{item.skill.name}</span><span className="skill-level">{item.count ? `${item.level}%` : 'Awaiting practice'}</span></div><ProgressBar value={item.level} /></div>)}</div><div className="skill-note"><Sparkles size={13} /> Practice to get your first evidence-based estimate.</div><button className="text-action" onClick={onChallenge}>Practice a skill <ArrowRight size={14} /></button></section>
    </div>

    <div className="section-heading lower-heading"><div><h2>Find your next opportunity</h2><p>Sample listings to help you prepare for what's next.</p></div><button className="text-action" onClick={onOpportunities}>Browse all <ArrowRight size={14} /></button></div>
    <div className="bottom-grid"><OpportunityPreview item={opportunities[0]} onOpen={() => onOpenOpportunity(opportunities[0])} /><LeaderboardPreview onOpen={onArena} xp={state.xp} /><ActivityPreview attempts={attempts} /></div>
  </>
}

function Explore({ activeRole, onOpenRole }: { activeRole: Role; onOpenRole: (role: Role) => void }) {
  const [query, setQuery] = useState('')
  const filtered = roles.filter((role) => `${role.title} ${role.description} ${role.category} ${role.skillIds.map((id) => skills.find((item) => item.id === id)?.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageHeading eyebrow="DISCOVER" title="Find your direction" description="Start with a role. We'll help you find the skills and next steps to get there." />
    <div className="explore-search"><Search size={18} /><input aria-label="Filter roles" placeholder="Try Frontend Developer, SQL, or Data Analyst" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></div>
    <div className="role-list-heading"><span>{filtered.length} curated learning paths</span><span>Updated for this demo</span></div>
    {filtered.length ? <div className="role-grid">{filtered.map((role) => <RoleCard key={role.id} role={role} active={role.id === activeRole.id} onClick={() => onOpenRole(role)} />)}</div> : <EmptyState title="No roles match that search" body="Try a different role or skill name." action="Clear search" onAction={() => setQuery('')} />}
    <div className="explore-note"><Sparkles size={16} /><span><strong>Built around a real outcome.</strong> Each path links lessons, practice, and opportunity prep so you can see what to learn next.</span></div>
  </>
}

function RoleCard({ role, active, onClick }: { role: Role; active?: boolean; onClick: () => void }) {
  const Icon = role.icon === 'chart' ? BarChart3 : Code2
  return <button className={`role-card ${active ? 'role-card-active' : ''}`} onClick={onClick}><div className="role-card-top"><span className={`role-icon role-${role.tint}`}><Icon size={21} /></span><span className="role-level">{role.level}</span></div><div className="eyebrow">{role.category}</div><h3>{role.title}</h3><p>{role.description}</p><div className="role-skills">{role.skillIds.slice(0, 3).map((id) => <Pill key={id}>{skills.find((skill) => skill.id === id)?.name}</Pill>)}</div><div className="role-card-footer"><span><Clock3 size={14} /> {role.effort}</span><span className="role-card-link">Explore path <ArrowRight size={15} /></span></div></button>
}

function RoleDetail({ role, state, onBack, onStart, onOpenLesson }: { role: Role; state: DemoState; onBack: () => void; onStart: () => void; onOpenLesson: (item: RoadmapModule) => void }) {
  const roleModules = modules.filter((item) => item.roleId === role.id)
  const roleResources = Array.from(new Set(roleModules.flatMap((item) => item.resourceIds))).map((id) => resources.find((item) => item.id === id)!).filter(Boolean)
  const Icon = role.icon === 'chart' ? BarChart3 : Code2
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> All roles</button>
    <div className="role-detail-hero"><div className="role-detail-copy"><div className="eyebrow">{role.category} <span>·</span> CURATED LEARNING PATH</div><h1>{role.title}</h1><p>{role.description}</p><div className="role-detail-meta"><span><GraduationCap size={16} /> {role.level}</span><span><Clock3 size={16} /> {role.effort}</span><span><Layers3 size={16} /> {roleModules.length} modules</span></div><Button onClick={onStart}>{state.completedModuleIds.some((id) => roleModules.some((item) => item.id === id)) ? 'Continue path' : 'Start this path'} <ArrowRight size={15} /></Button></div><div className={`role-detail-art role-detail-${role.tint}`}><div className="role-detail-halo" /><span className="role-big-icon"><Icon size={40} strokeWidth={1.4} /></span><span className="floating-tag tag-a">{role.skillIds.length} core skills</span><span className="floating-tag tag-b">Guided roadmap</span><span className="floating-tag tag-c"><Sparkles size={14} /> Practice-led</span></div></div>
    <div className="section-heading role-skill-heading"><div><h2>Skills you'll build</h2><p>Progress is estimated from your practice, not a hiring guarantee.</p></div></div>
    <div className="role-skills-expanded">{role.skillIds.map((id, index) => <div className="role-skill-chip" key={id}><span className="skill-index">0{index + 1}</span><strong>{skills.find((item) => item.id === id)?.name}</strong><ChevronRight size={15} /></div>)}</div>
    <div className="section-heading roadmap-heading"><div><h2>Your roadmap</h2><p>A beginner-to-intermediate path built around small, practical steps.</p></div><Pill tone="teal">{roleModules.length} steps</Pill></div>
    <div className="roadmap-layout"><div className="roadmap-list">{roleModules.map((item, index) => <RoadmapRow key={item.id} item={item} index={index} completed={state.completedModuleIds.includes(item.id)} onClick={() => onOpenLesson(item)} />)}</div><aside className="roadmap-aside"><div className="aside-icon"><Icon size={18} /></div><div className="eyebrow">A GOOD PLACE TO BEGIN</div><h3>Keep the loop small.</h3><p>Learn one idea, try it in a realistic task, then use the feedback to choose what's next.</p><div className="aside-divider" /><span><Clock3 size={14} /> {role.effort}</span><span><Target size={14} /> One practice task per module</span></aside></div>
    <div className="section-heading resources-heading"><div><h2>Curated resources</h2><p>Hand-picked starting points. Links are included for convenience.</p></div><Pill>DEMO CURATION</Pill></div>
    <div className="resource-grid">{roleResources.map((item) => <ResourceCard key={item.id} item={item} />)}</div>
  </>
}

function RoadmapRow({ item, index, completed, onClick }: { item: RoadmapModule; index: number; completed: boolean; onClick: () => void }) {
  return <button className={`roadmap-row ${completed ? 'roadmap-complete' : ''}`} onClick={onClick}><span className="roadmap-number">{completed ? <Check size={14} /> : `0${index + 1}`}</span><span className="roadmap-row-copy"><span className="roadmap-row-title">{item.title}{completed && <Pill tone="teal">Completed</Pill>}</span><span>{item.subtitle}</span><small><Clock3 size={12} /> {item.duration} <span>·</span> {item.skillIds.map((id) => skills.find((skill) => skill.id === id)?.name).join(', ')}</small></span><span className="roadmap-row-arrow"><ArrowUpRight size={16} /></span></button>
}

function ResourceCard({ item }: { item: Resource }) {
  const Icon = item.type === 'Video' ? Activity : item.type === 'Course' ? GraduationCap : BookOpen
  return <article className="resource-card"><div className="resource-card-top"><span className="resource-type-icon"><Icon size={17} /></span><Pill tone="teal">{item.level}</Pill></div><span className="eyebrow">{item.type} · {item.provider}</span><h3>{item.title}</h3><div className="resource-meta"><span><Clock3 size={13} /> {item.duration}</span><span>{item.priceLabel}</span></div><div className="resource-foot"><Pill>{item.sourceStatus}</Pill><a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}><ExternalLink size={15} /></a></div></article>
}

function Learn({ role }: { role: Role; state: DemoState; onRoleChange: (id: string) => void; onOpenLesson: (item: RoadmapModule) => void; onPractice: (item: RoadmapModule) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LearningResource[]>([])
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [history, setHistory] = useState<{ id: string; query: string }[]>([])
  const [saved, setSaved] = useState<{id:string;resource:LearningResource}[]>([])
  const [savedRoadmaps, setSavedRoadmaps] = useState<Roadmap[]>([])
  const [savedSearch, setSavedSearch] = useState('')
  const [savedFilter, setSavedFilter] = useState('All types')
  const [typeFilter, setTypeFilter] = useState('All types')
  const [levelFilter, setLevelFilter] = useState('All levels')
  const [accessFilter, setAccessFilter] = useState('Any access')
  const [sourceFilter, setSourceFilter] = useState('All sources')
  const [languageFilter, setLanguageFilter] = useState('All languages')
  const [durationFilter, setDurationFilter] = useState('Any duration')
  const [sort, setSort] = useState('Most relevant')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [hasSession, setHasSession] = useState(() => Boolean(localStorage.getItem('bhumika_access_token') || localStorage.getItem('bhumika_refresh_token')))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recoveryAccessToken, setRecoveryAccessToken] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.get('type') === 'recovery' ? params.get('access_token') ?? '' : ''
  })
  const [registerMode, setRegisterMode] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  useEffect(() => { if (recoveryAccessToken && isPasswordRecoveryLink()) window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`) }, [recoveryAccessToken])
  async function signIn(e: React.FormEvent) { e.preventDefault(); setError(''); setAuthBusy(true); try { if (registerMode) { const result=await learningRegister(email,password); if(!result.signedIn){setNotice('Account created. Check your email to confirm, then sign in.');setRegisterMode(false);return} } else await learningSignIn(email,password); setHasSession(true); await loadAccountData(); setNotice(registerMode?'Account created.':'Signed in. Your saved learning is available.') } catch(e) { setError(e instanceof Error ? e.message : 'Authentication failed.') } finally { setAuthBusy(false) } }
  async function sendPasswordRecovery() { setError(''); setNotice(''); if (!email.trim()) { setError('Enter your email address first.'); return } setAuthBusy(true); try { await learningForgotPassword(email.trim()); setNotice('If that account exists, password recovery instructions have been requested.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not request password recovery.') } finally { setAuthBusy(false) } }
  async function updateRecoveredPassword(event: React.FormEvent) { event.preventDefault(); setError(''); setNotice(''); setAuthBusy(true); try { await learningUpdatePassword(recoveryAccessToken, newPassword); learningClearSession(); setHasSession(false); setSaved([]); setHistory([]); setSavedRoadmaps([]); setRoadmap(null); setRecoveryAccessToken(''); setPassword(''); setNewPassword(''); setNotice('Password updated. Sign in with your new password.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update your password.') } finally { setAuthBusy(false) } }
  useEffect(() => { let active=true; if(!localStorage.getItem('bhumika_access_token')&&!localStorage.getItem('bhumika_refresh_token')){setHasSession(false);setSessionReady(true);return()=>{active=false}} void learningCurrentUser().then(async()=>{if(!active)return;setHasSession(true);await loadAccountData()}).catch((cause)=>{if(!active)return;const message=cause instanceof Error?cause.message:'Could not restore your session.';if(/unreachable|network/i.test(message)){setError(message);setHasSession(true);return}learningClearSession();setHasSession(false);setSaved([]);setHistory([]);setSavedRoadmaps([])}).finally(()=>{if(active)setSessionReady(true)});return()=>{active=false} }, [])
  async function search(topic = query) { const value = topic.trim(); if (value.length < 2) { setError('Enter at least two characters to search.'); return } setQuery(value); setBusy(true); setError(''); setNotice(''); setRoadmap(null); try { const r = await learningRequest<{ resources: LearningResource[] }>('/learning/search', { method: 'POST', body: JSON.stringify({ query: value }) }); setResults(r.resources); if (!r.resources.length) setNotice('No resources were returned. Try a more specific topic.') } catch (e) { setError(e instanceof Error ? e.message : 'Search failed.') } finally { setBusy(false) } }
  async function saveResource(resource: LearningResource) { try { const r=await learningRequest<{saved:{id:string;resource:LearningResource}}>('/learning/save', { method: 'POST', body: JSON.stringify({ resource }) }); setSaved((items) => items.some((x) => x.resource.url === resource.url) ? items : [r.saved, ...items]); setNotice('Resource saved to your library.') } catch (e) { setError(e instanceof Error ? e.message : 'Sign in to save resources.') } }
  async function removeSaved(id:string){try{await learningRequest(`/learning/save/${id}`,{method:'DELETE'});setSaved(items=>items.filter(x=>x.id!==id))}catch(e){setError(e instanceof Error?e.message:'Could not remove saved resource.')}}
  async function loadAccountData(){const [h,s,r]=await Promise.all([learningRequest<{searches:{id:string;query:string}[]}>('/learning/history'),learningRequest<{resources:{id:string;resource:LearningResource}[]}>('/learning/saved'),learningRequest<{roadmaps:Roadmap[]}>('/learning/roadmaps')]);setHistory(h.searches);setSaved(s.resources);setSavedRoadmaps(r.roadmaps)}
  async function signOut(){try{await learningSignOut()}catch(e){setError(e instanceof Error?e.message:'Sign out failed.')}finally{setHasSession(false);setSaved([]);setHistory([]);setSavedRoadmaps([]);setRoadmap(null)}}
  async function openRoadmap(id:string){try{const r=await learningRequest<{roadmap:Roadmap;resources:LearningResource[]}>(`/learning/roadmaps/${id}`);setRoadmap(r.roadmap);setResults(r.resources);setQuery(r.roadmap.query)}catch(e){setError(e instanceof Error?e.message:'Could not open roadmap.')}}
  async function removeRoadmap(id:string){try{await learningRequest(`/learning/roadmaps/${id}`,{method:'DELETE'});setSavedRoadmaps(items=>items.filter(x=>x.id!==id));if(roadmap?.id===id)setRoadmap(null)}catch(e){setError(e instanceof Error?e.message:'Could not delete roadmap.')}}
  async function makeRoadmap() { setBusy(true); setError(''); setNotice(''); try { const r = await learningRequest<{ roadmap: Roadmap; resources: LearningResource[] }>('/learning/roadmap', { method: 'POST', body: JSON.stringify({ query, level: 'Beginner' }) }); setRoadmap(r.roadmap); setResults(r.resources); setSavedRoadmaps((items) => [r.roadmap, ...items.filter((item) => item.id !== r.roadmap.id)]); setNotice('Roadmap saved to your account.') } catch (e) { setError(e instanceof Error ? e.message : 'Roadmap generation failed.') } finally { setBusy(false) } }
  async function completeTopic(topic: Roadmap['topics'][number], completed: boolean) { if (!roadmap) return; try { const r = await learningRequest<{ roadmap: Pick<Roadmap, 'id'|'topics'> }>(`/learning/topics/${topic.id}/progress`, { method: 'PATCH', body: JSON.stringify({ roadmapId: roadmap.id, completed }) }); const updated = { ...roadmap, topics: r.roadmap.topics }; setRoadmap(updated); setSavedRoadmaps(items => items.map(item => item.id === updated.id ? { ...item, topics: updated.topics } : item)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not update progress.') } }
  const filteredSaved=saved.filter(x=>(x.resource.title+' '+x.resource.source).toLowerCase().includes(savedSearch.toLowerCase())&&(savedFilter==='All types'||x.resource.type===savedFilter))
  const sources = [...new Set(results.map((r) => r.source).filter(Boolean))].sort()
  const languages = [...new Set(results.map((r) => r.language).filter((value): value is string => Boolean(value)))].sort()
  const filtered = filterLearningResources(results, { type: typeFilter, level: levelFilter, access: accessFilter, source: sourceFilter, language: languageFilter, duration: durationFilter, sort })
  const progress = roadmap?.topics.length ? Math.round(roadmap.topics.filter((t) => t.completed).length / roadmap.topics.length * 100) : 0
  return <>
    <PageHeading eyebrow="LEARN ANYTHING" title="What would you like to learn?" description="Explore real tutorials, videos, documentation, and a guided path for any topic." />
    {recoveryAccessToken ? <form className="learning-session" onSubmit={(event)=>void updateRecoveredPassword(event)}><span>Choose a new password for your account.</span><input aria-label="New password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="New password"/><button type="submit" disabled={authBusy}>{authBusy?'Updating…':'Update password'}</button></form> : !sessionReady ? <div className="learning-session"><span>Checking your session…</span></div> : hasSession ? <div className="learning-session"><span>Saved searches and progress sync to your account.</span><button onClick={()=>void signOut()}>Sign out</button></div> : <form className="learning-session" onSubmit={signIn}><span>Sign in to save resources and track roadmap progress.</span><input aria-label="Email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input aria-label="Password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" minLength={8}/><button type="submit" disabled={authBusy}>{authBusy?(registerMode?"Creating…":"Signing in…"):(registerMode?"Create account":"Sign in")}</button><button type="button" onClick={()=>setRegisterMode(v=>!v)}>{registerMode?"I already have an account":"Create account"}</button>{!registerMode&&<button type="button" disabled={authBusy} onClick={()=>void sendPasswordRecovery()}>Forgot password?</button>}</form>}
    <form className="learning-search" onSubmit={(e) => { e.preventDefault(); void search() }}><Search size={19}/><input aria-label="Search a learning topic" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Try React.js, Python, or system design"/><Button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</Button></form>
    {!results.length && <section className="learning-section"><div className="eyebrow">SUGGESTED TOPICS</div><div className="learning-suggestions">{[role.title, 'React.js', 'Python', 'Data Structures and Algorithms', 'Machine Learning', 'Cybersecurity'].map((topic)=><button key={topic} onClick={()=>void search(topic)}>{topic}<ArrowUpRight size={13}/></button>)}</div>{history.length>0&&<><h2>Recent searches</h2><div className="learning-suggestions">{history.slice(0,8).map((item)=><button key={item.id} onClick={()=>void search(item.query)}>{item.query}<RotateCcw size={13}/></button>)}</div></>}</section>}
    {busy&&<div className="learning-loading" role="status"><LoaderCircle className="spin"/> Finding real resources and videos…</div>}{error&&<div className="field-error" role="alert">{error}</div>}{notice&&<div className="source-grounding">{notice}</div>}
    {results.length>0&&<><div className="section-heading"><div><h2>Resources for {query}</h2><p>{results.length} real results · AI explanations are included when available</p></div><Button onClick={()=>void makeRoadmap()} disabled={busy||!hasSession} title={!hasSession?'Sign in to generate and save a roadmap':''}>Generate learning roadmap</Button></div><div className="learning-filters"><select aria-label="Resource type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>{['All types','Video','Course','Article','Documentation','Practice'].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Difficulty" value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}>{['All levels','Beginner','Intermediate','Advanced'].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Access" value={accessFilter} onChange={e=>setAccessFilter(e.target.value)}>{['Any access','fully_free','partially_free','free_trial','paid','unknown'].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Source" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option>All sources</option>{sources.map(x=><option key={x}>{x}</option>)}</select>{languages.length>0&&<select aria-label="Language" value={languageFilter} onChange={e=>setLanguageFilter(e.target.value)}><option>All languages</option>{languages.map(x=><option key={x}>{x}</option>)}</select>}<select aria-label="Duration" value={durationFilter} onChange={e=>setDurationFilter(e.target.value)}>{['Any duration','Under 30 minutes','30–120 minutes','Over 2 hours'].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Sort resources" value={sort} onChange={e=>setSort(e.target.value)}><option>Most relevant</option>{results.some(resource=>Boolean(resource.estimatedTime))&&<option>Shortest duration</option>}<option>Beginner friendly</option><option>Advanced</option></select><button onClick={()=>{setTypeFilter('All types');setLevelFilter('All levels');setAccessFilter('Any access');setSourceFilter('All sources');setLanguageFilter('All languages');setDurationFilter('Any duration');setSort('Most relevant')}}>Clear all filters</button></div><div className="resource-grid">{filtered.length===0?<div className="learning-empty">No resources match these filters. Clear the filters to see your results.</div>:filtered.map((item)=><article className="resource-card" key={item.id}>{item.thumbnail&&<img className="learning-thumb" src={item.thumbnail} alt=""/>}<div className="resource-card-top"><span className="resource-type-icon"><BookOpen size={17}/></span><Pill tone="teal">{item.level}</Pill></div><span className="eyebrow">{item.type} · {item.source}</span><h3>{item.title}</h3><p>{item.description}</p>{item.reason&&<p><strong>Why it helps:</strong> {item.reason}</p>}<div className="resource-meta"><span>{item.freeAccess.replaceAll('_',' ')}</span><span>{item.estimatedTime??'Time not listed'}</span></div><div className="resource-foot"><button onClick={()=>void saveResource(item)} disabled={!hasSession} title={!hasSession?'Sign in to save resources':''}>{saved.some((entry)=>entry.resource.url===item.url)?'Saved':'Save'}</button><a href={item.url} target="_blank" rel="noreferrer">Open resource <ExternalLink size={14}/></a></div></article>)}</div></>}
    {roadmap&&<section className="learning-roadmap"><div className="section-heading"><div><div className="eyebrow">YOUR LEARNING ROADMAP</div><h2>{roadmap.title}</h2><p>{roadmap.created_at&&<>Created {new Date(roadmap.created_at).toLocaleDateString()} · </>}{roadmap.difficulty??'Beginner'} · {roadmap.estimatedTotalDuration||'Duration estimated by stage'} · {roadmap.topics.filter(t=>t.completed).length} of {roadmap.topics.length} stages complete</p></div><strong>{progress}%</strong></div><ProgressBar value={progress}/><button className="learning-continue" onClick={()=>{const next=roadmap.topics.findIndex(t=>!t.completed);const stage=document.querySelectorAll('.learning-stage')[next<0?0:next] as HTMLDetailsElement|undefined;if(stage){stage.open=true;stage.scrollIntoView({behavior:'smooth',block:'center'})}}}>{progress===100?'Review your roadmap':'Continue learning'} <ArrowRight size={14}/></button>{roadmap.topics.map((topic,index)=><details className="learning-stage" key={topic.id} open={index===roadmap.topics.findIndex(t=>!t.completed)}><summary><span>{topic.completed?<Check size={15}/>:String(index+1).padStart(2,'0')}</span><b>{topic.title}</b><Pill>{topic.difficulty}</Pill><Pill tone={topic.completed?'teal':'blue'}>{topic.completed?'Complete':'Not started'}</Pill></summary><p>{topic.explanation}</p><p><strong>Goal:</strong> {topic.objective}</p><p><strong>Estimated time:</strong> {topic.estimatedTime}</p>{topic.prerequisites.length>0&&<p><strong>Prerequisites:</strong> {topic.prerequisites.join(', ')}</p>}<p><strong>Practice:</strong> {topic.practiceSuggestions.join(' · ')}</p><p><strong>Mini-project:</strong> {topic.miniProject}</p>{topic.resourceIds.map(id=>results.find(r=>r.id===id)).filter((resource): resource is LearningResource=>Boolean(resource)).map(resource=><p className="learning-stage-resource" key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer">{resource.title} <ExternalLink size={13}/></a><small>{resource.source}{resource.estimatedTime?` · ${resource.estimatedTime}`:''}</small></p>)}<label><input type="checkbox" checked={topic.completed} onChange={e=>void completeTopic(topic,e.target.checked)}/> Mark stage complete</label></details>)}</section>}
    {hasSession&&<section className="learning-section"><h2>Saved resources ({filteredSaved.length})</h2><input aria-label="Search saved resources" placeholder="Search saved resources" value={savedSearch} onChange={e=>setSavedSearch(e.target.value)}/><select aria-label="Filter saved resources" value={savedFilter} onChange={e=>setSavedFilter(e.target.value)}>{['All types','Video','Course','Article','Documentation','Practice'].map(x=><option key={x}>{x}</option>)}</select>{filteredSaved.map(x=><p key={x.id}><a href={x.resource.url} target="_blank" rel="noreferrer">{x.resource.title}</a> · {x.resource.source} <button onClick={()=>void removeSaved(x.id)}>Remove</button></p>)}{savedRoadmaps.map(r=>{const percent=r.topics.length?Math.round(r.topics.filter(t=>t.completed).length/r.topics.length*100):0;return <p key={r.id}><button onClick={()=>void openRoadmap(r.id)}>Open roadmap: {r.title}</button> <small>{percent}% complete{r.created_at?` · ${new Date(r.created_at).toLocaleDateString()}`:''}</small> <button onClick={()=>void removeRoadmap(r.id)}>Delete</button></p>})}</section>}
  </>
}
function Lesson({ role, item, state, onBack, onPractice }: { role: Role; item: RoadmapModule; state: DemoState; onBack: () => void; onPractice: () => void }) {
  const resource = resources.find((entry) => entry.id === item.resourceIds[0])
  const index = modules.filter((entry) => entry.roleId === role.id).findIndex((entry) => entry.id === item.id)
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to learning path</button>
    <div className="lesson-layout"><article className="lesson-main"><div className="eyebrow">{role.title.toUpperCase()} <span>·</span> MODULE {index + 1}</div><h1>{item.title}</h1><p className="lesson-lede">{item.subtitle}</p><div className="lesson-info"><span><Clock3 size={14} /> {item.duration}</span><span><BookOpen size={14} /> {item.skillIds.map((id) => skills.find((skill) => skill.id === id)?.name).join(' · ')}</span>{state.completedModuleIds.includes(item.id) && <Pill tone="teal"><Check size={11} /> Completed</Pill>}</div>
      <div className="lesson-content"><div className="lesson-content-heading"><span className="lesson-spark"><Sparkles size={15} /></span><div><small>THE ESSENTIALS</small><h2>What to know</h2></div></div>{item.lesson.map((paragraph, i) => <div className="lesson-point" key={paragraph}><span>{String(i + 1).padStart(2, '0')}</span><p>{paragraph}</p></div>)}</div>
      {resource && <div className="lesson-resource"><div className="resource-type-icon"><BookOpen size={16} /></div><div><span className="eyebrow">CURATED DEMO RESOURCE</span><strong>{resource.title}</strong><small>{resource.provider} · {resource.duration} · {resource.priceLabel}</small></div><a href={resource.url} target="_blank" rel="noreferrer" aria-label="Open learning resource"><ExternalLink size={16} /></a></div>}
      <div className="lesson-cta"><div><span className="eyebrow">READY TO TRY IT?</span><strong>Put this idea into practice.</strong><span>You'll get specific feedback on what worked and what to improve.</span></div><Button onClick={onPractice}>Start skill check <ArrowRight size={15} /></Button></div>
    </article><aside className="lesson-aside"><div className="lesson-aside-top"><span><ListChecks size={16} /></span><span className="eyebrow">IN THIS MODULE</span></div><div className="lesson-step active"><span>1</span><div><strong>Learn the essentials</strong><small>{item.duration}</small></div><CheckCircle2 size={15} /></div><div className="lesson-step"><span>2</span><div><strong>Try a skill check</strong><small>Scenario · 8 min</small></div></div><div className="lesson-step"><span>3</span><div><strong>Review your feedback</strong><small>Rubric-based</small></div></div><div className="lesson-aside-foot"><Sparkles size={14} /><span>Feedback will explain its score and recommend one next step.</span></div></aside></div>
  </>
}

function Practice({ role, challenge, onBack, onSubmit }: { role: Role; challenge: Challenge; onBack: () => void; onSubmit: (answer: string) => void }) {
  const [answer, setAnswer] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [error, setError] = useState('')
  const [isEvaluating, setIsEvaluating] = useState(false)
  const timeLimitSeconds = Math.max(60, (Number.parseInt(challenge.timeLimit, 10) || 8) * 60)
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds)
  const [timeExpired, setTimeExpired] = useState(false)
  useEffect(() => { if (timeExpired) return; const timer = window.setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000); return () => window.clearInterval(timer) }, [timeExpired])
  useEffect(() => { if (secondsLeft !== 0 || timeExpired) return; setTimeExpired(true); setError('Time is up. Your response is being submitted.'); window.setTimeout(() => onSubmit(`Timed submission: ${answer}`), 350) }, [secondsLeft, timeExpired, answer, onSubmit])
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (timeExpired) return; if (!answer.trim() || (challenge.type === 'scenario' && answer.trim().length < 8)) { setError(challenge.type === 'multiple-choice' ? 'Choose an answer to continue.' : 'Write a little more so your feedback can be useful.'); return } if (!window.confirm('Submit this response for feedback? You cannot edit it after submission.')) return; setError(''); setIsEvaluating(true); window.setTimeout(() => { setIsEvaluating(false); onSubmit(answer) }, 320) }
  const clockText = `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to lesson</button>
    <div className="practice-progress"><span>SKILL CHECK <span>·</span> {role.title.toUpperCase()}</span><span><Clock3 size={13} /> <span className={secondsLeft < 60 ? 'practice-clock urgent' : 'practice-clock'}>{clockText}</span> remaining · {challenge.timeLimit} suggested</span></div>
    <div className="practice-layout"><section className="practice-main"><div className="practice-meta"><Pill tone="blue">{challenge.difficulty}</Pill><Pill>{challenge.type === 'multiple-choice' ? 'Multiple choice' : 'Scenario'}</Pill><span className="practice-skill">{skills.find((item) => item.id === challenge.skillId)?.name}</span></div><h1>{challenge.title}</h1><div className="prompt-card"><span className="prompt-label"><MessageSquareText size={15} /> {challenge.type === 'multiple-choice' ? 'QUICK QUIZ' : 'THE SCENARIO'}</span><p>{challenge.prompt}</p></div><form onSubmit={submit} className="answer-form"><label>{challenge.type === 'multiple-choice' ? 'Choose one answer' : 'Your response'} <span>{challenge.type === 'multiple-choice' ? 'One correct answer · You can review the explanation after.' : 'Share your reasoning, not just the final answer.'}</span></label>{challenge.type === 'multiple-choice' ? <div className="option-list">{challenge.options?.map((option, index) => <label className={`option-choice ${answer === option ? 'option-selected' : ''}`} key={option}><input type="radio" name="quiz-answer" value={option} checked={answer === option} onChange={() => setAnswer(option)} /><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></label>)}</div> : <textarea id="practice-answer" rows={8} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Start with what you think is happening, then explain what you would do and why..." />}{error && <div className="field-error" role="alert">{error}</div>}<div className="answer-form-footer"><span>{challenge.type === 'multiple-choice' ? 'Your choice stays on this device' : `${answer.trim().split(/\s+/).filter(Boolean).length} words · Your draft stays on this device`}</span><Button type="submit" disabled={isEvaluating || timeExpired}>{isEvaluating ? <><LoaderCircle className="spin" size={14} /> Checking your response…</> : timeExpired ? <>Time expired</> : <>Submit for feedback <ArrowRight size={15} /></>}</Button></div></form><div className="demo-eval-note"><Sparkles size={14} /><span>{challenge.type === 'multiple-choice' ? 'This objective demo quiz uses a fixed answer key.' : 'Demo evaluation: a local rubric estimates topic coverage and answer detail.'} The local countdown is for practice only and is not tamper-proof.</span></div></section>
      <aside className="rubric-sidebar"><div className="rubric-side-title"><span className="rubric-icon"><Award size={16} /></span><div><strong>What we'll look for</strong><small>Transparent scoring criteria</small></div></div><div className="rubric-list">{challenge.rubric.map((item, index) => <div className="rubric-item" key={item.label}><span className="rubric-number">0{index + 1}</span><div><strong>{item.label}</strong><p>{item.hint}</p></div><span className="rubric-max">{item.max} pts</span></div>)}</div><button className="hint-toggle" onClick={() => setShowHint(!showHint)}><CircleHelp size={15} /> {showHint ? 'Hide a helpful nudge' : 'Need a nudge?' }<ChevronDown size={14} /></button>{showHint && <div className="hint-box">Try to include the problem you see, the action you would take, and one way you would check the result.</div>}<div className="rubric-side-foot"><LockKeyhole size={13} /><span>Your answer is saved to this browser after submission.</span></div></aside></div>
  </>
}

function Results({ role, challenge, evaluation, attempt, onBack, onNext, onProgress }: { role: Role; challenge: Challenge; evaluation: Evaluation; attempt: Attempt | null; onBack: () => void; onNext: () => void; onProgress: () => void }) {
  const grade = evaluation.score >= 80 ? 'Strong start' : evaluation.score >= 55 ? 'Good foundation' : 'Keep building'
  const [copied, setCopied] = useState(false)
  async function copyExample() { try { await navigator.clipboard.writeText(evaluation.modelAnswer); setCopied(true) } catch { setCopied(false) } }
  return <>
    <div className="results-topline"><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to learning</button><Pill tone="teal"><Check size={11} /> Attempt saved · {attempt?.xp ? `+${attempt.xp} XP` : 'practice recorded'}</Pill></div>
    <div className="results-heading"><div><div className="eyebrow">PRACTICE REVIEW <span>·</span> {role.title.toUpperCase()}</div><h1>Your feedback is ready.</h1><p>Here's what your response showed and one clear next step.</p></div><div className="results-spark"><Sparkles size={21} /></div></div>
    <div className="results-grid"><section className="score-card"><div className="score-top"><span className="eyebrow">OVERALL PRACTICE SCORE</span><span className="score-estimate"><Activity size={12} /> ESTIMATE</span></div><div className="score-value">{evaluation.score}<span>/100</span></div><div className="score-grade">{grade}</div><ProgressBar value={evaluation.score} /><p>This score reflects visible topic coverage and answer detail for this demo exercise.</p><div className="score-stats"><span><Zap size={14} /> {attempt?.xp ? `+${attempt.xp} XP earned` : 'No repeat XP awarded'}</span><span><Clock3 size={14} /> {challenge.timeLimit} suggested</span></div></section>
      <section className="results-rubric card"><div className="results-section-title"><div><div className="eyebrow">THE BREAKDOWN</div><h2>How you did</h2></div><span>Based on this answer</span></div><div className="result-rubric-list">{evaluation.rubric.map((item) => <div className="result-rubric-row" key={item.label}><div className="result-rubric-main"><span className="result-rubric-dot" /><div><strong>{item.label}</strong><p>{item.reason}</p></div></div><span className="result-points">{item.score}<small> / {item.max}</small></span></div>)}</div></section>
      <section className="feedback-card card"><div className="feedback-heading"><span className="feedback-icon feedback-good"><Check size={15} /></span><div><div className="eyebrow">WHAT WORKED</div><h3>Strengths</h3></div></div><ul>{evaluation.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section className="feedback-card card"><div className="feedback-heading"><span className="feedback-icon feedback-next"><ArrowDownRight size={15} /></span><div><div className="eyebrow">A CHANCE TO GROW</div><h3>What to strengthen</h3></div></div><ul>{evaluation.gaps.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section className="model-answer-card"><div className="model-answer-heading"><span className="feedback-icon"><Sparkles size={15} /></span><div><div className="eyebrow">A STRONG ANSWER MIGHT INCLUDE</div><h3>Use this as a learning example</h3></div></div><p>{evaluation.modelAnswer}</p><div className="model-answer-foot"><span><CircleHelp size={13} /> This is an example, not the only correct answer.</span><button onClick={() => void copyExample()}>{copied ? 'Copied' : 'Copy example'} {copied ? <Check size={13} /> : <Copy size={13} />}</button></div></section>
      <div className="next-task-card"><div className="next-task-icon"><Target size={18} /></div><div><div className="eyebrow">YOUR NEXT PRACTICE</div><strong>{evaluation.nextTask}</strong><span>Suggested follow-up · {skills.find((item) => item.id === challenge.skillId)?.name}</span></div><Button onClick={onNext}>Try next task <ArrowRight size={14} /></Button></div>
    </div><p className="evaluation-caveat"><Sparkles size={13} /> {evaluation.caveat}</p><div className="results-bottom-actions"><button className="text-action" onClick={onProgress}>View dashboard <ArrowRight size={14} /></button><Button variant="secondary" onClick={onBack}>Review lesson</Button></div>
  </>
}

function Arena({ state, onChallenge, onCreate, onFriendResult, inviteCode, onClearInvite }: { state: DemoState; onChallenge: (id: string) => void; onCreate: (code: string, challengeId: string) => void; onFriendResult: (code: string, score: number) => void; inviteCode: string; onClearInvite: () => void }) {
  const [section, setSection] = useState('Overview')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [difficultyFilter, setDifficultyFilter] = useState('All levels')
  const [search, setSearch] = useState('')
  const [leaderPeriod, setLeaderPeriod] = useState<'All time' | 'This week'>('All time')
  const [createdChallengeId, setCreatedChallengeId] = useState('react-list')
  const [copied, setCopied] = useState(false)
  const [inviteTaskId, setInviteTaskId] = useState(() => new URLSearchParams(window.location.search).get('task') ?? '')
  const skillName = (id: string) => skills.find((skill) => skill.id === id)?.name ?? id
  const attempts = state.attempts.filter((attempt) => challenges.some((challenge) => challenge.id === attempt.challengeId))
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : null
  const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const practicedDays = new Set(attempts.map((attempt) => dayKey(new Date(attempt.completedAt))))
  const currentDay = new Date()
  const startDay = new Date(currentDay)
  if (!practicedDays.has(dayKey(startDay))) startDay.setDate(startDay.getDate() - 1)
  let currentStreak = 0
  for (let cursor = new Date(startDay); practicedDays.has(dayKey(cursor)); cursor.setDate(cursor.getDate() - 1)) currentStreak += 1
  const level = state.xp >= 2000 ? 'Master' : state.xp >= 1000 ? 'Expert' : state.xp >= 500 ? 'Skilled' : state.xp >= 150 ? 'Challenger' : 'Rookie'
  const today = new Date().toLocaleDateString()
  const daily = challenges[new Date().getDate() % challenges.length]
  const dailyDone = attempts.some((attempt) => attempt.challengeId === daily.id && new Date(attempt.completedAt).toLocaleDateString() === today)
  const latest = attempts[0]
  const categoryFor = (id: string) => arenaCategories.find((category) => category.challengeIds.includes(id))?.label ?? 'Programming fundamentals'
  const filtered = challenges.filter((item) => {
    const categoryMatch = categoryFilter === 'All categories' || arenaCategories.find((category) => category.label === categoryFilter)?.challengeIds.includes(item.id)
    const diff = item.difficulty.toLowerCase()
    const levelMatch = difficultyFilter === 'All levels' || (difficultyFilter === 'Beginner' ? diff === 'foundational' : difficultyFilter === 'Intermediate' ? diff === 'intermediate' : difficultyFilter === 'Advanced' ? diff === 'advanced' : difficultyFilter === 'Easy' ? diff === 'foundational' : difficultyFilter === 'Medium' ? diff === 'intermediate' : diff === 'advanced')
    const searchMatch = `${item.title} ${item.prompt} ${item.skillId} ${skillName(item.skillId)} ${arenaTopics[item.id] ?? ''} ${categoryFor(item.id)}`.toLowerCase().includes(search.toLowerCase())
    return categoryMatch && levelMatch && searchMatch
  })
  const skillProgress = skills.map((skill) => {
    const rows = attempts.filter((attempt) => challenges.find((challenge) => challenge.id === attempt.challengeId)?.skillId === skill.id)
    return { skill, rows, score: rows.length ? Math.round(rows.reduce((sum, attempt) => sum + attempt.score, 0) / rows.length) : null }
  }).filter((item) => item.rows.length || ['react', 'javascript', 'sql', 'communication', 'problem-solving'].includes(item.skill.id))
  const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weeklyXp = attempts.filter((attempt) => new Date(attempt.completedAt).getTime() >= weekCutoff).reduce((sum, attempt) => sum + attempt.xp, 0)
  const recentAttempts = attempts.filter((attempt) => new Date(attempt.completedAt).getTime() >= weekCutoff)
  const priorAttempts = attempts.filter((attempt) => { const age = Date.now() - new Date(attempt.completedAt).getTime(); return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000 })
  const weekChange = recentAttempts.length && priorAttempts.length ? Math.round(recentAttempts.reduce((sum, item) => sum + item.score, 0) / recentAttempts.length - priorAttempts.reduce((sum, item) => sum + item.score, 0) / priorAttempts.length) : null
  const leaderboard = [
    { name: 'Demo learner', score: leaderPeriod === 'This week' ? weeklyXp : state.xp, badge: 'You', mine: true },
    { name: 'Nisha P.', score: leaderPeriod === 'This week' ? 510 : 1280, badge: 'Seeded demo learner' },
    { name: 'Rohan M.', score: leaderPeriod === 'This week' ? 470 : 940, badge: 'Seeded demo learner' },
    { name: 'Maya K.', score: leaderPeriod === 'This week' ? 220 : 520, badge: 'Seeded demo learner' },
  ].sort((a, b) => b.score - a.score)
  function createLink() { const code = crypto.randomUUID().slice(0, 6).toUpperCase(); setInviteTaskId(createdChallengeId); const url = new URL(window.location.href); url.searchParams.set('challenge', code); url.searchParams.set('task', createdChallengeId); window.history.replaceState({}, '', url); onCreate(code, createdChallengeId) }
  const activeChallenge = state.arenaChallenges.find((item) => item.code === inviteCode)
  const sharedChallengeId = state.arenaChallenges.find((item) => item.code === inviteCode)?.challengeId ?? (challenges.some((item) => item.id === inviteTaskId) ? inviteTaskId : '')
  async function copyInvite() { const url = `${window.location.origin}${window.location.pathname}?challenge=${inviteCode}&task=${sharedChallengeId || createdChallengeId}`; try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setCopied(false) }; }
  const clearFilters = () => { setCategoryFilter('All categories'); setDifficultyFilter('All levels'); setSearch('') }
  const navItems = ['Overview', 'Challenges', 'Skill progress', 'Leaderboard', 'Achievements', 'Profile']
  return <>
    <PageHeading eyebrow="INTERVIEW PRACTICE" title="Welcome to the Arena." description="Your next interview starts here. Practise a real question, review what you can improve, and build evidence over time." action={<Pill tone="amber"><Users size={12} /> LOCAL DEMO</Pill>} />
    <nav className="arena-subnav" aria-label="Arena sections">{navItems.map((item) => <button key={item} className={section === item ? 'selected' : ''} onClick={() => setSection(item)}>{item}</button>)}</nav>
    {inviteCode && <div className="invite-banner"><div className="invite-banner-icon"><Users size={18} /></div><div><strong>Challenge {inviteCode} is ready to share.</strong><p>Anyone opening this demo link can see the invite and try a comparable practice task.</p></div><button className="icon-button" aria-label="Dismiss invite banner" onClick={onClearInvite}><X size={16} /></button></div>}
    {section === 'Overview' && <>
      <section className="arena-welcome"><div><span className="arena-label"><Sparkles size={14} /> YOUR INTERVIEW PRACTICE SPACE</span><h2>Your next interview starts here.</h2><p>Start with one question. Your attempts and feedback stay on this device.</p><Button onClick={() => onChallenge(latest ? (challenges.find((item) => item.id !== latest.challengeId)?.id ?? daily.id) : daily.id)}>Start practising <ArrowRight size={15} /></Button></div><div className="arena-level"><span>ARENA LEVEL</span><strong>{level}</strong><small>{state.xp} XP · {currentStreak} day streak</small></div></section>
      <div className="arena-stat-grid"><ArenaStat label="Challenges attempted" value={attempts.length} note={attempts.length ? `${new Set(attempts.map((item) => item.challengeId)).size} unique questions` : 'Complete your first question'} /><ArenaStat label="Average score" value={average === null ? '—' : `${average}/100`} note={average === null ? 'No score history yet' : 'Across saved attempts'} /><ArenaStat label="Arena rank" value="—" note="No verified global ranking in this demo" /><ArenaStat label="Skills practised" value={new Set(attempts.map((item) => challenges.find((challenge) => challenge.id === item.challengeId)?.skillId).filter(Boolean)).size} note={`${state.xp} XP earned from first attempts`} /><ArenaStat label="Weekly score change" value={weekChange === null ? '—' : `${weekChange > 0 ? '+' : ''}${weekChange}`} note={weekChange === null ? 'Need attempts in two weeks to compare' : 'Average score vs. prior 7 days'} /><ArenaStat label="Practice time" value="—" note="Time spent is not recorded in this demo" /></div>
      <div className="arena-top-grid"><section className="arena-challenge-card"><div className="arena-card-top"><span className="arena-label"><Target size={14} /> TODAY'S QUESTION</span><Pill tone="amber">{dailyDone ? 'COMPLETED TODAY' : '+25 XP FIRST ATTEMPT'}</Pill></div><h2>{daily.title}</h2><p>{arenaTopics[daily.id] ?? skillName(daily.skillId)} · {daily.difficulty} · {daily.timeLimit}</p><div className="arena-daily-note">{dailyDone ? 'You have completed today’s featured question. Revisit it for practice; XP is awarded once per question.' : 'A focused interview prompt picked for today. Your answer is reviewed with a visible practice rubric.'}</div><Button disabled={dailyDone} onClick={() => onChallenge(daily.id)}>{dailyDone ? 'Done for today' : 'Start daily challenge'} <ArrowRight size={14} /></Button></section>
        <section className="leaderboard-card"><div className="leaderboard-head"><div><span className="arena-label"><Trophy size={14} /> LEADERBOARD</span><h2>Keep your momentum</h2></div></div><div className="leaderboard-tabs"><button className={leaderPeriod === 'All time' ? 'selected' : ''} onClick={() => setLeaderPeriod('All time')}>All time</button><button className={leaderPeriod === 'This week' ? 'selected' : ''} onClick={() => setLeaderPeriod('This week')}>This week</button></div><div className="leaderboard-list">{leaderboard.slice(0, 3).map((person, index) => <div className={`leaderboard-row ${person.mine ? 'is-you' : ''}`} key={person.name}><span className={`leader-rank rank-${index + 1}`}>{index === 0 ? <Trophy size={13} /> : String(index + 1).padStart(2, '0')}</span><span className="leader-avatar">{person.name.split(' ').map((part) => part[0]).join('')}</span><span className="leader-name"><strong>{person.name}{person.mine && <small>YOU</small>}</strong><small>{person.badge}</small></span><span className="leader-score">{person.score.toLocaleString()} <small>XP</small></span></div>)}</div><div className="leaderboard-note"><Users size={13} /> Local XP is real; other entries are illustrative demo participants.</div></section></div>
      <section className="arena-inline-challenges"><div className="section-heading"><div><h2>Recommended next</h2><p>{latest ? `Your last practice was ${challenges.find((item) => item.id === latest.challengeId)?.title}. Try a different question to broaden your evidence.` : 'Start with a short question from one of these topics.'}</p></div><button className="text-action" onClick={() => setSection('Challenges')}>Browse all <ArrowRight size={14} /></button></div><div className="arena-task-grid">{(latest ? challenges.filter((item) => item.id !== latest.challengeId).slice(0, 3) : challenges.slice(0, 3)).map((item) => <ArenaChallengeCard key={item.id} item={item} attempts={attempts} onClick={() => onChallenge(item.id)} />)}</div></section>
      <div className="arena-category-grid">{arenaCategories.map((category) => { const Icon = category.icon; const categoryChallenges = challenges.filter((item) => category.challengeIds.includes(item.id)); const done = categoryChallenges.filter((item) => attempts.some((attempt) => attempt.challengeId === item.id)).length; const categoryAttempts = attempts.filter((attempt) => category.challengeIds.includes(attempt.challengeId)); const categoryAvg = categoryAttempts.length ? Math.round(categoryAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / categoryAttempts.length) : null; const distribution = `${categoryChallenges.filter((item) => item.difficulty === 'Foundational').length} easy · ${categoryChallenges.filter((item) => item.difficulty === 'Intermediate').length} medium · ${categoryChallenges.filter((item) => item.difficulty === 'Advanced').length} hard`; return <button className="arena-category-card" key={category.id} onClick={() => { setCategoryFilter(category.label); setSection('Challenges') }}><span><Icon size={18} /></span><strong>{category.label}</strong><small>{categoryChallenges.length} questions · {done} tried</small><small>{distribution}</small><small>{categoryAvg === null ? 'No score yet' : `${categoryAvg}/100 average estimate`}</small></button> })}</div>
    </>}
    {section === 'Challenges' && <><div className="section-heading"><div><h2>Challenge library</h2><p>Text interview prompts and a fixed-answer quiz. This demo does not execute code.</p></div><Pill tone="amber">{challenges.length} DEMO QUESTIONS</Pill></div><div className="arena-filter-bar"><label className="arena-search"><Search size={16} /><input aria-label="Search challenges" placeholder="Search title, topic, skill, or technology" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All categories</option>{arenaCategories.map((category) => <option key={category.id}>{category.label}</option>)}</select></label><label><span>Level</span><select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>{['All levels', 'Beginner', 'Intermediate', 'Advanced', 'Easy', 'Medium', 'Hard'].map((item) => <option key={item}>{item}</option>)}</select></label><button className="text-action" onClick={clearFilters}>Clear filters</button></div><div className="arena-task-grid">{filtered.map((item) => <ArenaChallengeCard key={item.id} item={item} attempts={attempts} onClick={() => onChallenge(item.id)} />)}</div>{!filtered.length && <EmptyState title="No questions match those filters" body="Try a different topic or clear the filters to see the full question bank." action="Clear filters" onAction={clearFilters} />}</>}
    {section === 'Skill progress' && <><div className="section-heading"><div><h2>Your skill map</h2><p>Estimates update from your saved practice attempts. One attempt is early evidence, not mastery.</p></div></div><div className="arena-skill-grid">{skillProgress.map(({ skill, rows, score }) => <section className="arena-skill-card" key={skill.id}><div><strong>{skill.name}</strong><Pill>{rows.length} {rows.length === 1 ? 'attempt' : 'attempts'}</Pill></div>{score === null ? <p>Not assessed yet · try a related question to get a first estimate.</p> : <><div className="arena-skill-score">{score}<small>/100 average estimate</small></div><ProgressBar value={score} /><small>Latest practice: {rows[0].score}/100 · {new Date(rows[0].completedAt).toLocaleDateString()}</small></>}</section>)}</div><div className="section-heading arena-history-heading"><div><h2>Recent practice</h2><p>Review your latest saved attempts and estimated scores.</p></div></div>{attempts.length ? <div className="arena-history-list">{attempts.slice(0, 6).map((attempt) => { const challenge = challenges.find((item) => item.id === attempt.challengeId); return <div className="arena-history-row" key={attempt.id}><span className="arena-history-mark"><Check size={14} /></span><div><strong>{challenge?.title ?? 'Practice question'}</strong><small>{challenge ? skillName(challenge.skillId) : 'Interview practice'} · {new Date(attempt.completedAt).toLocaleString()}</small></div><span>{attempt.score}<small>/100</small></span></div> })}</div> : <EmptyState title="No practice history yet" body="Start a question in Challenges. Your saved attempts will appear here." action="Browse challenges" onAction={() => setSection('Challenges')} />}</>}
    {section === 'Leaderboard' && <><div className="section-heading"><div><h2>{leaderPeriod} XP board</h2><p>Your score is calculated from saved attempts. Other learners are seeded demo entries.</p></div></div><div className="leaderboard-card arena-leaderboard-full"><div className="leaderboard-tabs"><button className={leaderPeriod === 'All time' ? 'selected' : ''} onClick={() => setLeaderPeriod('All time')}>All time</button><button className={leaderPeriod === 'This week' ? 'selected' : ''} onClick={() => setLeaderPeriod('This week')}>Last 7 days</button></div><div className="leaderboard-list">{leaderboard.map((person, index) => <div className={`leaderboard-row ${person.mine ? 'is-you' : ''}`} key={person.name}><span className={`leader-rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span><span className="leader-avatar">{person.name.split(' ').map((part) => part[0]).join('')}</span><span className="leader-name"><strong>{person.name}</strong><small>{person.badge}</small></span><span className="leader-score">{person.score.toLocaleString()} <small>XP</small></span></div>)}</div><div className="leaderboard-note"><Users size={13} /> Demo rankings are illustrative. No global, friend, or college leaderboard service is connected.</div></div></>}
    {section === 'Achievements' && <><div className="section-heading"><div><h2>Achievements</h2><p>Milestones unlock from your actual saved attempts.</p></div></div><div className="arena-achievement-grid">{[{ title: 'First answer', body: 'Complete your first interview question.', unlocked: attempts.length >= 1 }, { title: 'Perfect check', body: 'Score 100 on a fixed-answer quiz.', unlocked: attempts.some((attempt) => attempt.score === 100) }, { title: 'Five questions', body: 'Complete five practice attempts.', unlocked: attempts.length >= 5 }, { title: 'Skill explorer', body: 'Practise three different skills.', unlocked: new Set(attempts.map((attempt) => challenges.find((item) => item.id === attempt.challengeId)?.skillId)).size >= 3 }].map((achievement) => <div className={`arena-achievement ${achievement.unlocked ? 'unlocked' : ''}`} key={achievement.title}><span>{achievement.unlocked ? <CheckCircle2 size={19} /> : <LockKeyhole size={18} />}</span><div><strong>{achievement.title}</strong><small>{achievement.body}</small></div><Pill tone={achievement.unlocked ? 'teal' : 'neutral'}>{achievement.unlocked ? 'Earned' : 'In progress'}</Pill></div>)}</div></>}
    {section === 'Profile' && <><div className="section-heading"><div><h2>Arena profile</h2><p>Private local demo profile. There is no account system or public profile service.</p></div></div><div className="arena-profile-card"><span className="avatar">{state.profile.name ? state.profile.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() : 'DL'}</span><div><strong>{state.profile.name || 'Demo learner'}</strong><small>{state.profile.education || 'Add education in Resume Studio if you want it saved in this browser.'}</small></div><Pill tone="teal">{level}</Pill><div className="arena-profile-stats"><span><strong>{state.xp}</strong>XP</span><span><strong>{attempts.length}</strong>Attempts</span><span><strong>{average ?? '—'}</strong>Average score</span></div></div></>}
    {(section === 'Overview' || section === 'Challenges') && <section className="arena-share-area"><div className="arena-share-intro"><div><span className="arena-label"><Users size={14} /> CHALLENGE A FRIEND</span><h2>Share a question to practise together.</h2><p>Creates a local invite link to the same prompt. Attempts do not sync across devices in this demo.</p></div><div className="challenge-select-row"><label htmlFor="arena-challenge-select">Question</label><select id="arena-challenge-select" value={createdChallengeId} onChange={(event) => setCreatedChallengeId(event.target.value)}>{challenges.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><ChevronDown size={14} /></div><Button onClick={createLink}><Plus size={15} /> Create invite link</Button></div>{inviteCode && <section className="share-challenge-card card"><div className="share-challenge-icon"><Send size={17} /></div><div className="share-challenge-copy"><div className="eyebrow">LOCAL INVITE CODE · {inviteCode}</div><strong>{window.location.origin}{window.location.pathname}?challenge={inviteCode}&amp;task={sharedChallengeId || createdChallengeId}</strong><span>Copy the link to open this same prompt. Cross-device scores are not synced.</span></div><Button variant="secondary" onClick={() => void copyInvite()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy link'}</Button>{sharedChallengeId && <Button variant="outline" onClick={() => onChallenge(sharedChallengeId)}>Try this question <ArrowRight size={14} /></Button>}{activeChallenge && !activeChallenge.friendScore && <Button variant="quiet" onClick={() => onFriendResult(inviteCode, 62 + inviteCode.charCodeAt(0) % 32)}>Preview friend result</Button>}{activeChallenge?.friendScore && <Pill tone="teal">Friend score: {activeChallenge.friendScore}/100</Pill>}</section>}</section>}
  </>
}

function ArenaStat({ label, value, note }: { label: string; value: string | number; note: string }) { return <section className="arena-stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></section> }
function ArenaChallengeCard({ item, attempts, onClick }: { item: Challenge; attempts: Attempt[]; onClick: () => void }) { const mine = attempts.filter((attempt) => attempt.challengeId === item.id); const Icon = arenaCategories.find((category) => category.challengeIds.includes(item.id))?.icon ?? Target; return <button className="arena-library-card" onClick={onClick}><span className="arena-library-icon"><Icon size={18} /></span><span className="arena-library-category">{arenaCategories.find((category) => category.challengeIds.includes(item.id))?.label ?? 'Interview fundamentals'}</span><Pill tone={item.difficulty === 'Intermediate' ? 'amber' : 'teal'}>{item.difficulty}</Pill><strong>{item.title}</strong><span className="arena-library-topic">{arenaTopics[item.id] ?? item.skillId} · {item.type === 'multiple-choice' ? 'Quick quiz' : 'Interview scenario'}</span><small><Clock3 size={12} /> {item.timeLimit} · {item.rubric.length} rubric criteria {mine.length ? `· ${mine.length} attempts` : ''}</small><span className="arena-library-action">Start question <ArrowRight size={13} /></span></button> }

function OpportunitiesPage({ onOpen, onResume }: { onOpen: (item: Opportunity) => void; onResume: (item: Opportunity) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All opportunities')
  const filtered = opportunities.filter((item) => `${item.title} ${item.company} ${item.location} ${item.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All opportunities' || item.type === filter))
  return <>
    <PageHeading eyebrow="DISCOVER & PREPARE" title="Opportunities" description="Explore example listings, then prepare an application using your own facts." action={<Pill>EXAMPLE LISTINGS</Pill>} />
    <div className="opportunity-toolbar"><div className="explore-search compact-search"><Search size={17} /><input aria-label="Search opportunities" placeholder="Search role, company, or skill" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="filter-select"><select aria-label="Filter opportunity type" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All opportunities</option><option>Internship</option><option>Early career</option></select><ChevronDown size={14} /></div></div>
    {filtered.length ? <div className="opportunity-grid">{filtered.map((item) => <OpportunityCard key={item.id} item={item} onOpen={() => onOpen(item)} onResume={() => onResume(item)} />)}</div> : <EmptyState title="No listings found" body="Try a different company, role, or skill." action="Clear filters" onAction={() => { setQuery(''); setFilter('All opportunities') }} />}
    <div className="demo-listings-note"><Sparkles size={15} /><span>These are example listings created for the product demo. No live job search is connected.</span></div>
  </>
}

function OpportunityCard({ item, onOpen, onResume }: { item: Opportunity; onOpen: () => void; onResume: () => void }) {
  return <article className="opportunity-card"><div className="opportunity-company-row"><span className="company-mark">{item.company.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{item.company}</strong><small>{item.location}</small></span><Pill tone="amber">Example listing</Pill></div><h3>{item.title}</h3><div className="opportunity-meta"><Pill>{item.type}</Pill><span><Clock3 size={12} /> {item.posted}</span></div><p>{item.description}</p><div className="opportunity-skills">{item.skills.slice(0, 3).map((id) => <Pill tone="teal" key={id}>{skills.find((skill) => skill.id === id)?.name}</Pill>)}</div><div className="opportunity-card-actions"><Button variant="secondary" onClick={onOpen}>View details <ArrowRight size={14} /></Button><button className="quiet-link" onClick={onResume}>Prepare application <ArrowUpRight size={14} /></button></div></article>
}

function OpportunityPreview({ item, onOpen }: { item: Opportunity; onOpen: () => void }) {
  return <button className="opportunity-preview card" onClick={onOpen}><div className="preview-top"><span className="section-label"><BriefcaseBusiness size={14} /> OPPORTUNITY MATCH</span><Pill tone="amber">Example listing</Pill></div><div className="preview-company"><span className="company-mark">NL</span><span><strong>{item.company}</strong><small>{item.location}</small></span><ArrowUpRight size={16} /></div><h3>{item.title}</h3><div className="preview-fit"><span><Sparkles size={13} /> Could match skills in your path</span><span>Check details</span></div></button>
}

function OpportunityDetail({ item, onBack, onPrepare }: { item: Opportunity; onBack: () => void; onPrepare: () => void }) {
  const role = roles.find((candidate) => candidate.skillIds.some((id) => item.skills.includes(id)))
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> All opportunities</button>
    <div className="opportunity-detail-layout"><article className="opportunity-detail-main"><div className="opportunity-company-row"><span className="company-mark">{item.company.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{item.company}</strong><small>{item.location}</small></span><Pill tone="amber">Example listing</Pill></div><h1>{item.title}</h1><div className="opportunity-detail-meta"><Pill>{item.type}</Pill><span><Clock3 size={13} /> {item.posted}</span><span><MapPinIcon /> {item.location}</span></div><h2>About this opportunity</h2><p>{item.description}</p><h2>What they're looking for</h2><ul className="requirements-list">{item.requirements.map((requirement) => <li key={requirement}><CheckCircle2 size={15} /> {requirement}</li>)}</ul><div className="detail-source-note"><ExternalLink size={14} /><span>This is a demo listing. It is not a verified open position.</span><a href={item.url} target="_blank" rel="noreferrer">Example link</a></div></article><aside className="match-card card"><span className="match-card-icon"><Sparkles size={18} /></span><div className="eyebrow">WHY IT MAY FIT</div><h3>A starting point for your next application.</h3><p>This listing shares skills with the <strong>{role?.title ?? 'selected role'}</strong> learning path.</p><div className="match-skill-list">{item.skills.map((id) => <span key={id}><CheckCircle2 size={14} /> {skills.find((skill) => skill.id === id)?.name}</span>)}</div><div className="match-disclaimer">Your match is based on role-path skills, not a hiring prediction.</div><Button onClick={onPrepare}>Prepare an application <ArrowRight size={14} /></Button></aside></div>
  </>
}

function MapPinIcon() { return <span className="pin-icon">⌖</span> }

function ResumeStudio({ state, opportunity, onProfileChange, onSaveApplication }: { state: DemoState; opportunity: Opportunity; onProfileChange: (profile: DemoState['profile']) => void; onSaveApplication: (application: Application) => void }) {
  const [jobDescription, setJobDescription] = useState(`${opportunity.description}\n\nRequirements\n${opportunity.requirements.map((requirement) => `• ${requirement}`).join('\n')}`)
  const [resumeDraft, setResumeDraft] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [missing, setMissing] = useState<string[]>([])
  const [formError, setFormError] = useState('')
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState('')
  const [pdfStatus, setPdfStatus] = useState('')
  const [readingPdf, setReadingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const profile = state.profile
  const setField = (field: keyof typeof profile, value: string) => onProfileChange({ ...profile, [field]: value })

  async function importResumePdf(file?: File) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPdfStatus('Choose a PDF file to import.')
      return
    }
    setReadingPdf(true)
    setPdfStatus('Reading your PDF on this device…')
    try {
      const imported = await readResumePdf(file)
      const detected = Object.entries(imported).filter(([, value]) => Boolean(value)) as [keyof typeof profile, string][]
      if (!detected.length) {
        setPdfStatus('No profile details were recognized. You can still enter them manually.')
        return
      }
      const nextProfile = { ...profile }
      let updatedCount = 0
      for (const [field, value] of detected) {
        const existing = profile[field].trim()
        if (!existing) {
          nextProfile[field] = value
          updatedCount += 1
        } else if (field !== 'name' && field !== 'email' && !existing.toLowerCase().includes(value.toLowerCase())) {
          nextProfile[field] = `${existing}${field === 'education' ? ' · ' : '\n'}${value}`
          updatedCount += 1
        }
      }
      onProfileChange(nextProfile)
      setPdfStatus(updatedCount ? `Filled ${updatedCount} field${updatedCount === 1 ? '' : 's'}. Review the details below.` : 'Those details are already in your profile, so nothing needed changing.')
    } catch (error) {
      setPdfStatus(error instanceof Error ? error.message : 'Could not read this PDF. Try another file.')
    } finally {
      setReadingPdf(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  function generate(event: React.FormEvent) {
    event.preventDefault()
    const factText = [profile.name, profile.education, profile.skills, profile.projects, profile.experience, profile.links].filter((value) => value.trim()).join('\n')
    if (!factText.trim()) { setFormError('Add at least one profile fact before creating a draft.'); return }
    if (!jobDescription.trim()) { setFormError('Add a job description so the draft has context.'); return }
    setFormError('')
    const suppliedSkills = profile.skills.split(/[,\n]/).map((part) => part.trim()).filter(Boolean)
    const explicitRequirements = jobDescription.split('\n').filter((line) => /^\s*[•*-]\s+/.test(line)).map((line) => line.replace(/^\s*[•*-]\s+/, '').trim()).filter(Boolean)
    const requirementsForCheck = explicitRequirements.length ? explicitRequirements : opportunity.requirements.filter((requirement) => jobDescription.toLowerCase().includes(requirement.toLowerCase()))
    const matchedSkills = suppliedSkills.filter((skill) => jobDescription.toLowerCase().includes(skill.toLowerCase()))
    const evidenceWords = factText.toLowerCase().split(/\W+/).filter((word) => word.length > 3)
    const requirementsWithoutEvidence = requirementsForCheck.filter((requirement) => !evidenceWords.some((word) => requirement.toLowerCase().includes(word)))
    const summaryParts = []
    if (profile.education) summaryParts.push('Education supplied: ' + profile.education)
    if (suppliedSkills.length) summaryParts.push('Skills supplied: ' + suppliedSkills.join(', ') + '.')
    if (matchedSkills.length) summaryParts.push('Skills that also appear in the listing: ' + matchedSkills.join(', ') + '.')
    const summary = summaryParts.join('\n') || 'Add education or skills if you want a summary based on those facts.'
    const bullets = (value: string) => value.split(/[,\n]/).map((line) => line.trim()).filter(Boolean).map((line) => '• ' + line).join('\n')
    const sections = []
    if (profile.name) sections.push(profile.name)
    sections.push('RESUME SUMMARY NOTES\n' + summary)
    if (profile.education) sections.push('EDUCATION\n' + profile.education)
    if (suppliedSkills.length) sections.push('SKILLS YOU LISTED\n' + bullets(profile.skills))
    if (profile.projects) sections.push('PROJECTS YOU DESCRIBED\n' + bullets(profile.projects))
    if (profile.experience) sections.push('EXPERIENCE YOU DESCRIBED\n' + bullets(profile.experience))
    if (profile.links) sections.push('LINKS\n' + profile.links)
    const questions = requirementsWithoutEvidence.map((item) => '• What evidence can you share for: ' + item + '?').join('\n') || (requirementsForCheck.length ? 'No obvious gaps found by the simple keyword check. Review this carefully before using it.' : 'No explicit requirement bullets were detected. Review the listing manually before using this draft.')
    setResumeDraft(sections.join('\n\n') + '\n\nQUESTIONS BEFORE YOU APPLY\n' + questions)
    const roleText = `${opportunity.title} ${jobDescription}`.toLowerCase()
    const stopWords = new Set(['about', 'after', 'also', 'and', 'are', 'for', 'from', 'have', 'into', 'with', 'your', 'will', 'the', 'this', 'that', 'their', 'they', 'you', 'our', 'who', 'what', 'when', 'where', 'work', 'role', 'team', 'experience', 'skills', 'ability', 'strong', 'good', 'using', 'use', 'across', 'including', 'such', 'looking', 'candidate', 'years'])
    const roleWords = new Set(roleText.match(/[a-z][a-z0-9+#.-]{2,}/g)?.filter((word) => !stopWords.has(word)) ?? [])
    const relevantFacts = (value: string) => value
      .split(/\n+|(?<=[.!?])\s+/)
      .map((fact) => fact.replace(/^\s*[•*-]\s*/, '').trim())
      .filter(Boolean)
      .map((fact) => {
        const words = fact.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []
        return { fact, score: words.filter((word) => roleWords.has(word) && !stopWords.has(word)).length }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(({ fact }) => fact.length > 170 ? `${fact.slice(0, 167).trimEnd()}…` : fact)
    const relevantExperience = relevantFacts(profile.experience)
    const relevantProjects = relevantFacts(profile.projects)
    const relevantSkills = matchedSkills.slice(0, 4)
    const evidenceLines = [
      ...relevantExperience.map((fact) => `My relevant experience includes ${fact}.`),
      ...relevantProjects.map((fact) => `A project related to this role: ${fact}.`),
      relevantSkills.length ? `Relevant skills I bring include ${relevantSkills.join(', ')}.` : '',
    ].filter(Boolean)
    const emailBody = evidenceLines.length
      ? `I’m applying for the ${opportunity.title} role. ${evidenceLines.join(' ')}`
      : `I’m applying for the ${opportunity.title} role. I’d welcome the opportunity to discuss how my background could fit your needs.`
    setMessageDraft(`Subject: Application for ${opportunity.title}\n\nHello ${opportunity.company} team,\n\n${emailBody}\n\nThank you for your consideration,\n${profile.name || '[Your name]'}${profile.email ? `\n${profile.email}` : ''}`)
    setMissing(requirementsWithoutEvidence.length ? requirementsWithoutEvidence : requirementsForCheck.length ? [] : ['No explicit requirement bullets were detected. Review the listing manually.']); setGenerated(true)
  }
  async function copy(text: string, key: string) { try { await navigator.clipboard.writeText(text); setCopied(key) } catch { setCopied('') } }
  function exportDraft() {
    const file = new Blob([`RESUME NOTES\n\n${resumeDraft}\n\nAPPLICATION EMAIL\n\n${messageDraft}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = 'bhumika-application-draft.txt'; link.click(); URL.revokeObjectURL(url)
  }
  function save() {
    if (!generated) return
    onSaveApplication({ id: `${Date.now()}`, opportunityId: opportunity.id, title: opportunity.title, company: opportunity.company, status: 'Draft', updatedAt: new Date().toISOString(), resumeDraft, messageDraft })
  }

  return <>
    <PageHeading eyebrow="PREPARE WITH YOUR FACTS" title="Resume Studio" description="Create a reviewable draft for one opportunity. Nothing is sent or submitted here." action={<Pill tone="teal"><LockKeyhole size={12} /> YOUR FACTS ONLY</Pill>} />
    <div className="resume-progress"><span className="resume-step active"><i>1</i> Profile facts</span><span className="resume-step-line" /><span className={`resume-step ${generated ? 'active' : ''}`}><i>2</i> Tailored draft</span><span className="resume-step-line" /><span className="resume-step"><i>3</i> Review & save</span></div>
    <div className="resume-layout"><form className="resume-form card" onSubmit={generate}><div className="resume-form-head"><div><div className="eyebrow">YOUR INFORMATION</div><h2>Tell us what you've done.</h2><p>Only the facts you enter below can appear in your draft.</p></div><span className="resume-form-icon"><UserRound size={18} /></span></div>
      <div className="resume-import"><input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => void importResumePdf(event.target.files?.[0])} /><Button type="button" variant="secondary" disabled={readingPdf} onClick={() => pdfInputRef.current?.click()}>{readingPdf ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />} {readingPdf ? 'Reading PDF…' : 'Import resume PDF'}</Button><span>Your file stays on this device. Check imported details before using them.</span>{pdfStatus && <div className="resume-import-status" role="status">{pdfStatus}</div>}</div>
      <label className="field-label">Name <span>Optional</span><input value={profile.name} onChange={(event) => setField('name', event.target.value)} placeholder="Your name" /></label>
      <div className="form-two-col"><label className="field-label">Email <span>Optional</span><input type="email" value={profile.email} onChange={(event) => setField('email', event.target.value)} placeholder="you@example.com" /></label><label className="field-label">Education <span>Optional</span><input value={profile.education} onChange={(event) => setField('education', event.target.value)} placeholder="Degree, institution, or current year" /></label></div>
      <label className="field-label">Skills <span>List only what you can discuss</span><textarea rows={2} value={profile.skills} onChange={(event) => setField('skills', event.target.value)} placeholder="e.g. JavaScript, React, SQL" /></label>
      <label className="field-label">Projects <span>Use your own words</span><textarea rows={3} value={profile.projects} onChange={(event) => setField('projects', event.target.value)} placeholder="Project name, what you built, and your contribution" /></label>
      <label className="field-label">Experience <span>Optional</span><textarea rows={3} value={profile.experience} onChange={(event) => setField('experience', event.target.value)} placeholder="Work, volunteering, campus roles, or other experience" /></label>
      <label className="field-label">Links <span>Optional</span><input value={profile.links} onChange={(event) => setField('links', event.target.value)} placeholder="Portfolio, GitHub, LinkedIn" /></label>
      <div className="field-label job-description-label">Job description <span>Prefilled from the example listing; edit freely</span><textarea rows={5} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} /></div>
      {formError && <div className="field-error" role="alert">{formError}</div>}
      <div className="resume-form-bottom"><span><LockKeyhole size={13} /> Saved only in this browser</span><Button type="submit"><Sparkles size={15} /> Build my draft</Button></div>
    </form>
    <section className="resume-preview-col"><div className="resume-selected-job card"><span className="company-mark">{opportunity.company.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><span className="eyebrow">TAILORING FOR</span><strong>{opportunity.title}</strong><small>{opportunity.company} · Example listing</small></div><BriefcaseBusiness size={17} /></div>
      {generated ? <><div className="tailoring-insight card"><div className="tailoring-insight-heading"><span><Sparkles size={15} /></span><div><strong>Draft grounded in your profile</strong><small>Generated from facts you supplied above.</small></div></div><div className="evidence-pills">{profile.skills.split(/[,\n]/).map((value) => value.trim()).filter(Boolean).slice(0, 5).map((value) => <Pill tone="teal" key={value}>{value}</Pill>)}</div>{missing.length > 0 && <div className="missing-evidence"><div><CircleHelp size={14} /><strong>Questions for you</strong></div>{missing.map((item) => <span key={item}>{item.startsWith('No explicit') ? item : `What evidence can you share for “${item}”?`}</span>)}</div>}</div>
        <div className="draft-card card"><div className="draft-card-head"><div><span className="eyebrow">TAILORED RESUME SUMMARY & BULLETS</span><span className="draft-edit-label"><Activity size={12} /> Editable draft · profile facts only</span></div><button className="icon-button" aria-label="Copy resume draft" onClick={() => void copy(resumeDraft, 'resume')}>{copied === 'resume' ? <Check size={15} /> : <Copy size={15} />}</button></div><textarea aria-label="Resume draft, editable" value={resumeDraft} onChange={(event) => setResumeDraft(event.target.value)} rows={12} /></div>
        <div className="draft-card card"><div className="draft-card-head"><div><span className="eyebrow">APPLICATION EMAIL</span><span className="draft-edit-label"><Activity size={12} /> Editable draft</span></div><button className="icon-button" aria-label="Copy email draft" onClick={() => void copy(messageDraft, 'message')}>{copied === 'message' ? <Check size={15} /> : <Copy size={15} />}</button></div><textarea aria-label="Application email draft, editable" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} rows={9} /></div>
        <div className="draft-actions"><Button variant="secondary" onClick={exportDraft}><Download size={14} /> Export .txt</Button><Button variant="secondary" onClick={() => window.print()}><FileText size={14} /> Print / save PDF</Button><Button onClick={save}><Check size={14} /> Save to tracker</Button></div>
        <div className="resume-safety-note"><LockKeyhole size={14} /><span>Review every line before using it. No email will be sent and no application will be submitted.</span></div></> : <div className="resume-empty card"><div className="resume-empty-art"><FileText size={28} /><span><Sparkles size={14} /></span></div><h3>Your draft will appear here.</h3><p>Enter at least one profile fact, then build a draft grounded in the details you supplied.</p><div><CheckCircle2 size={14} /> No invented experience or achievements</div><div><CheckCircle2 size={14} /> Missing evidence becomes a question</div></div>}
    </section></div>
  </>
}

function Applications({ state, onStatus, onPrepare }: { state: DemoState; onStatus: (id: string, status: ApplicationStatus) => void; onPrepare: () => void }) {
  const statuses: ApplicationStatus[] = ['Draft', 'Ready for review', 'Applied', 'Interview', 'Rejected / Closed']
  return <>
    <PageHeading eyebrow="YOUR NEXT CHAPTER" title="Application tracker" description="Keep your drafts and application status in one place. You confirm each status change." action={<Button onClick={onPrepare}><Plus size={15} /> New application draft</Button>} />
    <div className="application-summary"><div><span className="application-summary-icon"><FileText size={17} /></span><span><strong>{state.applications.length}</strong><small>tracked applications</small></span></div><span className="tracker-rule"><LockKeyhole size={13} /> Bhūmikā never submits applications for you.</span></div>
    {state.applications.length ? <div className="application-list">{state.applications.map((item) => <article className="application-row card" key={item.id}><span className="company-mark">{item.company.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div className="application-row-main"><div className="application-title-line"><h3>{item.title}</h3><Pill tone={item.status === 'Applied' || item.status === 'Interview' ? 'teal' : item.status === 'Draft' ? 'amber' : 'neutral'}>{item.status}</Pill></div><p>{item.company} <span>·</span> Updated {new Date(item.updatedAt).toLocaleDateString()}</p><details className="application-draft-toggle"><summary>Review saved draft <ArrowUpRight size={13} /></summary><div className="saved-drafts"><strong>Resume notes</strong><pre>{item.resumeDraft ?? 'Resume draft not saved.'}</pre><strong>Application email</strong><pre>{item.messageDraft ?? 'Email draft not saved.'}</pre></div></details></div><label className="status-control">Update status<select value={item.status} onChange={(event) => onStatus(item.id, event.target.value as ApplicationStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={13} /></label></article>)}</div> : <EmptyState title="Your tracker starts with a draft" body="Tailor a resume and application note in Resume Studio, then save it here for review." action="Prepare a draft" onAction={onPrepare} />}
    <div className="application-status-hint"><span className="eyebrow">STATUS GUIDE</span><div>{statuses.map((status, index) => <span key={status}><i>{String(index + 1).padStart(2, '0')}</i>{status}{index < statuses.length - 1 && <ArrowRight size={13} />}</span>)}</div><p>“Applied” requires your confirmation. We only record the status you choose.</p></div>
  </>
}

function LeaderboardPreview({ onOpen, xp }: { onOpen: () => void; xp: number }) {
  return <button className="leader-preview card" onClick={onOpen}><div className="preview-top"><span className="section-label"><Trophy size={14} /> ARENA</span><span className="leader-preview-link">View leaderboard <ArrowRight size={13} /></span></div><div className="preview-leader-lines"><span><i className="leader-medal">1</i><b>Nisha P.</b><small>1,280 XP</small></span><span><i>2</i><b>Rohan M.</b><small>940 XP</small></span><span className="preview-you"><i>3</i><b>Demo learner <em>YOU</em></b><small>{xp.toLocaleString()} XP</small></span></div></button>
}

function ActivityPreview({ attempts }: { attempts: Attempt[] }) {
  return <section className="activity-preview card"><div className="preview-top"><span className="section-label"><Activity size={14} /> RECENT PRACTICE</span><span className="activity-count">{attempts.length} total</span></div>{attempts.length ? <div className="activity-list">{attempts.slice(0, 2).map((attempt) => { const challenge = challenges.find((item) => item.id === attempt.challengeId); return <div className="activity-row" key={attempt.id}><span className="activity-mark"><Check size={13} /></span><span className="activity-copy"><strong>{challenge?.title ?? 'Practice attempt'}</strong><small>{skills.find((item) => item.id === challenge?.skillId)?.name} · {new Date(attempt.completedAt).toLocaleDateString()}</small></span><span className="activity-score">{attempt.score}<small>/100</small></span></div> })}</div> : <div className="activity-empty"><span>Complete a lesson check to save your first attempt here.</span><span>Scores and skill estimates build from practice.</span></div>}</section>
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-state-icon"><Layers3 size={21} /></span><h3>{title}</h3><p>{body}</p>{action && onAction && <Button variant="secondary" onClick={onAction}>{action} <ArrowRight size={14} /></Button>}</div>
}

export default App
