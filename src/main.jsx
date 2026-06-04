import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './lib/AuthContext.jsx'
import { CurrencyProvider } from './lib/CurrencyContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import Services from './pages/Services.jsx'
import Portfolio from './pages/Portfolio.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import Book from './pages/Book.jsx'
import Login from './pages/Login.jsx'
import Portal from './pages/Portal.jsx'
import EventPage from './pages/EventPage.jsx'
import Vendors from './pages/Vendors.jsx'
import VendorProfile from './pages/VendorProfile.jsx'
import Playbooks from './pages/Playbooks.jsx'
import PlaybookDetail from './pages/PlaybookDetail.jsx'
import Concierge from './pages/Concierge.jsx'
import OrgDashboard from './pages/OrgDashboard.jsx'
import OrgClient from './pages/OrgClient.jsx'
import OrgVendors from './pages/OrgVendors.jsx'
import OrgMessages from './pages/OrgMessages.jsx'
import OrgTeam from './pages/OrgTeam.jsx'
import NotFound from './pages/NotFound.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
       <CurrencyProvider>
        <Routes>
          {/* Standalone public event microsite — its own immersive chrome */}
          <Route path="/e/:slug" element={<EventPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/vendors/:slug" element={<VendorProfile />} />
            <Route path="/playbooks" element={<Playbooks />} />
            <Route path="/playbooks/:slug" element={<PlaybookDetail />} />
            <Route path="/concierge" element={<Concierge />} />
            <Route path="/book" element={<Book />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/portal"
              element={
                <ProtectedRoute>
                  <Portal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org"
              element={
                <ProtectedRoute>
                  <OrgDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org/clients/:id"
              element={
                <ProtectedRoute>
                  <OrgClient />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org/vendors"
              element={
                <ProtectedRoute>
                  <OrgVendors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org/messages"
              element={
                <ProtectedRoute>
                  <OrgMessages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org/team"
              element={
                <ProtectedRoute>
                  <OrgTeam />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
       </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
