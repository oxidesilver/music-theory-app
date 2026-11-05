import type { RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from '@/features/home/HomePage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { MorePage } from '@/features/more/MorePage';
import { NotFoundPage } from '@/features/NotFoundPage';
import { ChordDictionaryPage } from '@/features/chord-dictionary/ChordDictionaryPage';
import { LearnPage } from '@/features/learn/LearnPage';
import { LessonPage } from '@/features/learn/LessonPage';
import { ProgressPage } from '@/features/progress/ProgressPage';
import { ComposePage, EarTrainingPage, GenresPage, LibraryPage, ProgressionPage } from '@/features/placeholders';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'learn/:lessonId', element: <LessonPage /> },
      { path: 'progression/*', element: <ProgressionPage /> },
      { path: 'chords/:root?/:quality?', element: <ChordDictionaryPage /> },
      { path: 'ear/*', element: <EarTrainingPage /> },
      { path: 'compose/*', element: <ComposePage /> },
      { path: 'genres/*', element: <GenresPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
