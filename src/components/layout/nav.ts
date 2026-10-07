import {
  LayoutDashboard,
  Route,
  CalendarRange,
  Repeat,
  FlaskConical,
  FileText,
  Stethoscope,
  Terminal,
  Layers,
  Table,
  Sigma,
  Braces,
  Code,
  Database,
  Sheet,
  Activity,
  ShieldCheck,
  GitBranch,
  Briefcase,
  Milestone,
  MessagesSquare,
  SquareTerminal,
  Library,
  ArrowLeftRight,
  GraduationCap,
  HardDrive,
  FolderGit2,
  BookBookmark,
  ChartColumn,
  NotebookPen,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match nested routes as active. */
  prefix?: string;
  badge?: 'review';
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Learning Path', to: '/path', icon: Route },
      { label: 'Weekly Plan', to: '/plan', icon: CalendarRange },
      { label: 'Review Queue', to: '/review', icon: Repeat, badge: 'review' },
    ],
  },
  {
    label: 'Study',
    items: [
      { label: 'Trial Simulator', to: '/trial', icon: FlaskConical, prefix: '/trial' },
      { label: 'Study Documents', to: '/documents', icon: FileText, prefix: '/documents' },
      { label: 'Datasets', to: '/data', icon: HardDrive, prefix: '/data' },
    ],
  },
  {
    label: 'Labs',
    items: [
      { label: 'Clinical Trials', to: '/learn/trials', icon: Stethoscope, prefix: '/learn/trials' },
      { label: 'SAS Lab', to: '/learn/sas', icon: Terminal, prefix: '/learn/sas' },
      { label: 'CDISC Lab', to: '/learn/cdisc', icon: Layers, prefix: '/learn/cdisc' },
      { label: 'TLF Lab', to: '/learn/tlf', icon: Table, prefix: '/learn/tlf' },
      { label: 'Statistics Lab', to: '/learn/stats', icon: Sigma, prefix: '/learn/stats' },
      { label: 'R Lab', to: '/learn/r', icon: Braces, prefix: '/learn/r' },
      { label: 'Python Lab', to: '/learn/python', icon: Code, prefix: '/learn/python' },
      { label: 'SQL Lab', to: '/learn/sql', icon: Database, prefix: '/learn/sql' },
      { label: 'Excel Lab', to: '/learn/excel', icon: Sheet, prefix: '/learn/excel' },
      { label: 'Analytics Lab', to: '/learn/analytics', icon: Activity, prefix: '/learn/analytics' },
      { label: 'QC Lab', to: '/learn/qc', icon: ShieldCheck, prefix: '/learn/qc' },
      { label: 'Reproducibility', to: '/learn/git', icon: GitBranch, prefix: '/learn/git' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { label: 'Case Studies', to: '/cases', icon: Briefcase, prefix: '/cases' },
      { label: 'Capstones', to: '/capstones', icon: Milestone, prefix: '/capstones' },
      { label: 'Interview Center', to: '/interview', icon: MessagesSquare, prefix: '/interview' },
      { label: 'SQL Workbench', to: '/sql', icon: SquareTerminal, prefix: '/sql' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Reference Library', to: '/reference', icon: Library, prefix: '/reference' },
      { label: 'Code Crosswalk', to: '/crosswalk', icon: ArrowLeftRight, prefix: '/crosswalk' },
      { label: 'MS Companion', to: '/companion', icon: GraduationCap, prefix: '/companion' },
      { label: 'Portfolio', to: '/portfolio', icon: FolderGit2, prefix: '/portfolio' },
      { label: 'Standards & Sources', to: '/sources', icon: BookBookmark, prefix: '/sources' },
    ],
  },
  {
    label: 'You',
    items: [
      { label: 'Progress & Skills', to: '/progress', icon: ChartColumn, prefix: '/progress' },
      { label: 'Notes & Bookmarks', to: '/notes', icon: NotebookPen, prefix: '/notes' },
      { label: 'Settings', to: '/settings', icon: Settings, prefix: '/settings' },
    ],
  },
];
