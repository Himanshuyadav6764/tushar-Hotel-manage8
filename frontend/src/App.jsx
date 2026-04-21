import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import { MODULES, ROLES } from './config/rbac'
import Navbar from './components/Navbar'
import TopBar from './components/TopBar'
import Hero from './components/Hero'
import FadeInSection from './components/FadeInSection'
import FloatingDashboard from './components/FloatingDashboard'
import ThreeColumnFeatures from './components/ThreeColumnFeatures'
import FeaturesAndStats from './components/FeaturesAndStats'
import Footer from './components/Footer'
import Login from './pages/Login/Login'
import AdminDashboard from './pages/Dashboard/AdminDashboard'
import SuperAdminDashboard from './pages/SuperAdmin/SuperAdminDashboard'
import HotelsManagement from './pages/SuperAdmin/HotelsManagement'
import CreateHotel from './pages/SuperAdmin/CreateHotel'
import HotelDetails from './pages/SuperAdmin/HotelDetails'
import ActivityMonitoring from './pages/SuperAdmin/ActivityMonitoring'
import SuperAdminLogin from './pages/SuperAdmin/SuperAdminLogin'
import QRScanPage from './pages/QRScan/QRScanPage'
import GuestOrderSuccessPage from './pages/QRScan/GuestOrderSuccessPage'
import FoodOrderPage from './components/FoodOrderPage'
import About from './pages/About'
import FeaturesPage from './pages/Features'
import Pricing from './pages/Pricing'
import Contact from './pages/Contact'
import './index.css'
import Reveal from './components/Reveal'
import Brands from './components/Brands'
import ServicesOverview from './components/ServicesOverview'
import Vision from './components/Vision'
import AdvikaAI from './components/AdvikaAI'
import { useState } from 'react'

import { MotionDiv, fadeUp } from './components/MotionWrapper';

import DemoForm from './components/DemoForm'
import FAQSection from './components/FAQSection'

function HomePageContent() {
  return (
    <>
      <Hero />
      <MotionDiv variant={fadeUp}><Brands /></MotionDiv>
      <Vision />
      <ServicesOverview />
      <MotionDiv variant={fadeUp}><DemoForm /></MotionDiv>
      <MotionDiv variant={fadeUp}><FAQSection /></MotionDiv>
      <MotionDiv variant={fadeUp}><FeaturesAndStats /></MotionDiv>
    </>
  )
}



const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { user, logout } = useAuth();
  const isAdminRoute = location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/super-admin') ||
    location.pathname.startsWith('/secure-owner-login');
  const isProtectedPath = (pathname) => pathname.startsWith('/admin') || pathname.startsWith('/super-admin');
  const isLoginPath = (pathname) => pathname === '/login' || pathname === '/secure-owner-login' || pathname === '/superadmin/login';

  const [sidebarActive, setSidebarActive] = useState(false);

  // Manage body class for scrolling behavior
  useEffect(() => {
    if (isAdminRoute) {
      document.body.classList.remove('public-page');
    } else {
      document.body.classList.add('public-page');
    }

    if (sidebarActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.classList.remove('public-page');
      document.body.style.overflow = 'auto';
    };
  }, [isAdminRoute, sidebarActive]);

  useEffect(() => {
    // If user reaches login page using browser back/forward, invalidate current session.
    if (navigationType === 'POP' && isLoginPath(location.pathname) && localStorage.getItem('authUser')) {
      logout();
    }
  }, [location.pathname, navigationType, logout]);

  useEffect(() => {
    const enforceAuthForPath = (pathname) => {
      const hasStoredAuth = !!localStorage.getItem('authUser');
      if (!hasStoredAuth && isProtectedPath(pathname)) {
        navigate('/login', { replace: true });
      }
    };

    enforceAuthForPath(location.pathname);

    const onPopState = () => {
      enforceAuthForPath(window.location.pathname);
    };

    const onPageShow = (event) => {
      if (event.persisted) {
        enforceAuthForPath(window.location.pathname);
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [location.pathname, navigate, user]);

  return (
    <div className="App">
      {!isAdminRoute && (
        <>
          <TopBar />
          <Navbar />
        </>
      )}
      <div>
        <Routes location={location}>
          {/* Public Routes */}
          <Route path="/" element={<HomePageContent />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />

          {/* Super Admin Login Routes - Supporting both paths */}
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/secure-owner-login" element={<SuperAdminLogin />} />

          {/* Super Admin Routes */}
          <Route path="/super-admin/dashboard" element={
            <ProtectedRoute module={MODULES.SUPER_ADMIN_DASHBOARD}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/super-admin/hotels" element={
            <ProtectedRoute module={MODULES.SUPER_ADMIN_DASHBOARD}>
              <HotelsManagement />
            </ProtectedRoute>
          } />
          <Route path="/super-admin/hotels/create" element={
            <ProtectedRoute module={MODULES.SUPER_ADMIN_DASHBOARD}>
              <CreateHotel />
            </ProtectedRoute>
          } />
          <Route path="/super-admin/hotels/:id" element={
            <ProtectedRoute module={MODULES.SUPER_ADMIN_DASHBOARD}>
              <HotelDetails />
            </ProtectedRoute>
          } />
          <Route path="/super-admin/activity-monitoring" element={
            <ProtectedRoute module={MODULES.SUPER_ADMIN_DASHBOARD}>
              <ActivityMonitoring />
            </ProtectedRoute>
          } />

          {/* Protected Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute module={MODULES.DASHBOARD}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/rooms" element={
            <ProtectedRoute module={MODULES.ROOMS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/reservations" element={
            <ProtectedRoute module={MODULES.RESERVATIONS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/guest-meal-service" element={
            <ProtectedRoute module={MODULES.GUEST_MEAL_SERVICE}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/food-menu" element={
            <ProtectedRoute module={MODULES.FOOD_MENU}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/customers" element={
            <ProtectedRoute module={MODULES.CUSTOMERS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/staff" element={
            <ProtectedRoute module={MODULES.STAFF}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/crm-model" element={
            <ProtectedRoute module={MODULES.CRM_MODEL}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/stay-overview" element={
            <ProtectedRoute module={MODULES.RESERVATIONS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/reservation-stay-management" element={
            <ProtectedRoute module={MODULES.RESERVATIONS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/view-reservation" element={
            <ProtectedRoute module={MODULES.RESERVATIONS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/room-service" element={
            <ProtectedRoute module="room-service">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/housekeeping" element={
            <ProtectedRoute module="housekeeping">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/view-order" element={
            <ProtectedRoute module={MODULES.VIEW_ORDER}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/reservation-card" element={
            <ProtectedRoute module={MODULES.RESERVATIONS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/my-profile" element={
            <ProtectedRoute module={MODULES.PROFILE}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/cashier-report" element={
            <ProtectedRoute module={MODULES.CASHIER_LOGS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/food-payment-report" element={
            <ProtectedRoute module={MODULES.PAYMENT_LOGS}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/cashier-section" element={
            <ProtectedRoute module={MODULES.CASHIER_SECTION}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/food-order" element={
            <ProtectedRoute module={MODULES.FOOD_ORDER}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* New Report Routes */}
          <Route path="/admin/reports-sales" element={<ProtectedRoute module={MODULES.REPORTS_SALES}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-payments" element={<ProtectedRoute module={MODULES.REPORTS_PAYMENTS}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-rooms" element={<ProtectedRoute module={MODULES.REPORTS_ROOMS}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-kitchen" element={<ProtectedRoute module={MODULES.REPORTS_KITCHEN}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-gst" element={<ProtectedRoute module={MODULES.REPORTS_GST}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-staff" element={<ProtectedRoute module={MODULES.REPORTS_STAFF}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-billing" element={<ProtectedRoute module={MODULES.REPORTS_BILLING}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-reservations" element={<ProtectedRoute module={MODULES.REPORTS_RESERVATIONS}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reports-analytics" element={<ProtectedRoute module={MODULES.REPORTS_ANALYTICS}><AdminDashboard /></ProtectedRoute>} />

          {/* Property Setup Routes */}
          <Route path="/admin/discount" element={<ProtectedRoute module={MODULES.PROPERTY_SETUP}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/generate-room-qr" element={<ProtectedRoute module={MODULES.PROPERTY_SETUP}><AdminDashboard /></ProtectedRoute>} />

          {/* Property Configuration Routes */}

          <Route path="/admin/floor-setup" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />


          <Route path="/admin/room-facilities-type" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/meal-type" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/reservation-type" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/extra-charges" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/complimentary-services" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/customer-identity" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/booking-source" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/business-source" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/maintenance-block" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/table-management" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/company-settings" element={<ProtectedRoute module={MODULES.PROPERTY_CONFIG}><AdminDashboard /></ProtectedRoute>} />

          {/* Other Routes */}
          <Route path="/scan-qr/:roomId" element={<QRScanPage />} />
          <Route path="/order-success" element={<GuestOrderSuccessPage />} />
          <Route path="/qr-scan/:hotelId/:tableId" element={<QRScanPage />} />
          <Route path="/food-order" element={<FoodOrderPage />} />
          <Route path="/order" element={<FoodOrderPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
        {!isAdminRoute && <Footer />}
        {!isAdminRoute && <AdvikaAI />}
      </div>
    </div>
  )
}

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </SettingsProvider>
  )
}

export default App
