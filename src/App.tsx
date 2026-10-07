import { lazy, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { loadItems } from './content/registry';

const Dashboard = lazy(() => import('./features/dashboard/DashboardPage'));
const LearningPath = lazy(() => import('./features/path/LearningPathPage'));
const LabPage = lazy(() => import('./features/lab/LabPage'));
const LessonPage = lazy(() => import('./features/lesson/LessonPage'));
const PracticePage = lazy(() => import('./features/practice/PracticePage'));
const ProgressPage = lazy(() => import('./features/progress/ProgressPage'));
const SkillPage = lazy(() => import('./features/progress/SkillPage'));
const ReviewPage = lazy(() => import('./features/review/ReviewPage'));
const InterviewPage = lazy(() => import('./features/interview/InterviewPage'));
const ReferencePage = lazy(() => import('./features/reference/ReferencePage'));
const CrosswalkPage = lazy(() => import('./features/crosswalk/CrosswalkPage'));
const CompanionPage = lazy(() => import('./features/companion/CompanionPage'));
const DocumentsPage = lazy(() => import('./features/documents/DocumentsPage'));
const DataCatalogPage = lazy(() => import('./features/datasets/DataCatalogPage'));
const DatasetPage = lazy(() => import('./features/datasets/DatasetPage'));
const TrialPage = lazy(() => import('./features/trial/TrialPage'));
const SqlWorkbench = lazy(() => import('./features/sql/SqlWorkbenchPage'));
const CasesPage = lazy(() => import('./features/projects/CasesPage'));
const CapstonesPage = lazy(() => import('./features/projects/CapstonesPage'));
const PortfolioPage = lazy(() => import('./features/projects/PortfolioPage'));
const PlanPage = lazy(() => import('./features/plan/PlanPage'));
const NotesPage = lazy(() => import('./features/notes/NotesPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const SourcesPage = lazy(() => import('./features/sources/SourcesPage'));
const NotFound = lazy(() => import('./features/NotFound'));

export function App() {
  useEffect(() => {
    // Warm the practice-item index in the background; the dashboard, lessons and
    // mastery model all need it.
    const t = window.setTimeout(() => void loadItems(), 300);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="path" element={<LearningPath />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="learn/:lab" element={<LabPage />} />
          <Route path="learn/:lab/:lessonId" element={<LessonPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="progress/skill/:skillId" element={<SkillPage />} />
          <Route path="interview" element={<InterviewPage />} />
          <Route path="reference" element={<ReferencePage />} />
          <Route path="reference/:category" element={<ReferencePage />} />
          <Route path="reference/:category/:entryId" element={<ReferencePage />} />
          <Route path="crosswalk" element={<CrosswalkPage />} />
          <Route path="crosswalk/:taskId" element={<CrosswalkPage />} />
          <Route path="companion" element={<CompanionPage />} />
          <Route path="companion/:topicId" element={<CompanionPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:docId" element={<DocumentsPage />} />
          <Route path="data" element={<DataCatalogPage />} />
          <Route path="data/*" element={<DatasetPage />} />
          <Route path="trial" element={<TrialPage />} />
          <Route path="trial/:section" element={<TrialPage />} />
          <Route path="sql" element={<SqlWorkbench />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:caseId" element={<CasesPage />} />
          <Route path="capstones" element={<CapstonesPage />} />
          <Route path="capstones/:capstoneId" element={<CapstonesPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
