import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { Layout } from './components/Layout'
import { Toaster } from './components/ui'
import { useRoute } from './lib/router'
import { DashboardPage } from './pages/Dashboard'
import { ApplicationsPage } from './pages/Applications'
import { AnalyzerPage } from './pages/Analyzer'
import { ProfilePage } from './pages/Profile'
import { DocumentsPage } from './pages/Documents'
import { SettingsPage } from './pages/Settings'
import { ApplicationDetail } from './components/ApplicationDetail'

function Routes() {
  const [route] = useRoute()
  const { apps } = useStore()
  const [, force] = useState(0)
  useEffect(() => {
    // scroll to top on page change
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [route])

  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />
    case 'analyzer':
      return <AnalyzerPage prefApp={route.prefapp} />
    case 'profile':
      return <ProfilePage />
    case 'documents':
      return <DocumentsPage />
    case 'settings':
      return <SettingsPage />
    case 'application': {
      const exists = apps.some((a) => a.id === route.id)
      return exists ? (
        <>
          <ApplicationsPage />
          <ApplicationDetail appId={route.id} onClose={() => (window.location.hash = '#/applications')} />
        </>
      ) : (
        <ApplicationsPage />
      )
    }
    default:
      void force
      return <ApplicationsPage />
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Layout>
        <Routes />
      </Layout>
      <Toaster />
    </StoreProvider>
  )
}
