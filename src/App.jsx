
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Dashboard from './pages/Dashboard'
import { useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import Inventory from './pages/Inventory'
import InventoryForm from './pages/InventoryForm'
import Customers from './pages/Customers'
import CustomerForm from './pages/CustomerForm'
import Rentals from './pages/Rentals'
import RentalForm from './pages/RentalForm'
import RentalDetails from './pages/RentalDetails'
import CustomerDetails from './pages/CustomerDetails'
import ItemDetails from './pages/ItemDetails'
import RentalCalendar from './pages/Calendar'
import DialogProvider from './components/DialogProvider'
import { ThemeProvider } from './contexts/ThemeContext'

import Whatsapp from './pages/Whatsapp'
import Contracts from './pages/Contracts'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import UploadContract from './pages/UploadContract'
import Quotes from './pages/Quotes'
import QuoteDetails from './pages/QuoteDetails'
import QuoteForm from './pages/QuoteForm'

import Logistics from './pages/Logistics'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import AdminDashboard from './pages/AdminDashboard'
import Support from './pages/Support'
import CompleteProfile from './pages/CompleteProfile'

import Pricing from './pages/Pricing'
import Billing from './pages/Billing'
import Account from './pages/Account'
import ConfirmEmail from './pages/ConfirmEmail'
import Guide from './pages/Guide'

// Custom Protected Route for Clients (Users)
const ProtectedRoute = () => {
  const { user, loading, isSuspended, role, subscriptionStatus, profile } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
      <div className="text-[#13283b] dark:text-white font-black uppercase tracking-widest animate-pulse">
        Carregando Área Cliente...
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" />

  // 1. Check Suspension
  if (isSuspended) return <Navigate to="/suspended" />

  // 2. Check Admin Role (Admins go to /admin)
  if (role === 'admin') return <Navigate to="/admin" />

  // 3. ENFORCE PROFILE COMPLETION
  // If we lack critical data (tax_id, etc), force complete-profile
  if (profile && (!profile.tax_id || !profile.whatsapp || !profile.city || !profile.state)) {
    return <Navigate to="/complete-profile" replace />
  }

  // 4. ENFORCE PAYMENT: If not active, redirect to Pricing
  if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
    return <Navigate to="/pricing" replace />
  }

  return <Outlet />
}

// Route that only requires login (no subscription check)
const LoggedInRoute = () => {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
      <div className="text-[#13283b] dark:text-white font-black uppercase tracking-widest animate-pulse">
        Carregando...
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" />

  return <Outlet />
}

// Custom Protected Route for Admin Master
const AdminProtectedRoute = () => {
  const { user, role, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#13283b]">
      <div className="text-white font-black uppercase tracking-widest animate-pulse">
        Acesso Admin Master...
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" />
  if (role !== 'admin') return <Navigate to="/dashboard" />
  return <Outlet />
}

function App() {
  const { user, loading, role, subscriptionStatus } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
      <div className="text-[#13283b] dark:text-white font-black uppercase tracking-widest animate-pulse">
        Sincronizando Risu...
      </div>
    </div>
  )

  // Home redirect - always shows Landing, except for admin
  const getHomeRedirect = () => {
    if (user && role === 'admin') return <Navigate to="/admin" replace />
    return <Landing />
  }

  // Auth redirect - if logged in, go to landing (or admin for admins)
  const getAuthRedirect = (Component) => {
    if (!user) return <Component />
    if (role === 'admin') return <Navigate to="/admin" replace />
    // Regular users go to landing page
    return <Navigate to="/" replace />
  }

  return (
    <BrowserRouter>
      <DialogProvider>
        <Routes>
          <Route path="/" element={getHomeRedirect()} />
          <Route path="/login" element={getAuthRedirect(Login)} />
          <Route path="/signup" element={getAuthRedirect(Signup)} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
          <Route path="/suspended" element={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8 text-center font-black uppercase tracking-widest text-red-600 italic">
              Sua conta foi suspensa temporariamente. Entre em contato com o administrador.
            </div>
          } />

          <Route path="/upload-contract/:rentalId" element={<UploadContract />} />

          {/* Master Admin Routes */}
          <Route element={<AdminProtectedRoute />}>
            <Route path="/admin/*" element={<AdminDashboard />} />
          </Route>

          {/* Routes that only require login (no subscription) */}
          <Route element={<LoggedInRoute />}>
            <Route path="/account" element={<Account />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/billing" element={<Billing />} />
          </Route>

          {/* Client App Routes (require active subscription) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/new" element={<InventoryForm />} />
              <Route path="/inventory/:id" element={<InventoryForm />} />
              <Route path="/inventory/:id/details" element={<ItemDetails />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/new" element={<CustomerForm />} />
              <Route path="/customers/:id" element={<CustomerForm />} />
              <Route path="/customers/:id/details" element={<CustomerDetails />} />
              <Route path="/rentals" element={<Rentals />} />
              <Route path="/rentals/new" element={<RentalForm />} />
              <Route path="/rentals/:id" element={<RentalDetails />} />
              <Route path="/calendar" element={<RentalCalendar />} />
              <Route path="/logistics" element={<Logistics />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/whatsapp" element={<Whatsapp />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/quotes/new" element={<QuoteForm />} />
              <Route path="/quotes/:id" element={<QuoteDetails />} />
              <Route path="/quotes/:id/edit" element={<QuoteForm />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/support" element={<Support />} />
              <Route path="/guide" element={<Guide />} />
            </Route>
          </Route>
        </Routes>
      </DialogProvider>
    </BrowserRouter>
  )
}

export default App
