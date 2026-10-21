/**
 * @module routes/RoutesDonaton
 * @author Remi García, Benjamin Llanquiman y Ricardo Díaz
 * @description Componente para rutas de navegación de la aplicación web de Donaton.
 *
 * En este componente se agrupan las distintas rutas de navegación de la
 * plataforma web de Donaton.
*/

import { BrowserRouter, Route, Routes } from "react-router";
import Landing from "../pages/Landing";
import Login from "../pages/Login";
import Contacto from "../pages/Contacto";
import VoluntarioPanel from "../pages/VoluntarioPanel";
import ColaboradorPanel from "../pages/ColaboradorPanel";
import AdminDashboard from "../pages/AdminDashboard";
import RegistroUsuarios from "../pages/RegistroUsuarios";
import ColasPanel from "../pages/ColasPanel";
import { ProtectedRoute } from "./ProtectedRoute";
import { Rol } from "../types/rolEnum";

/**
* Rutas de navegación de la plataforma web
*
* @returns Rutas para ser usadas con hook `useNavigate` de dependencia `react-router`.
*/
export default function RoutesDonaton () {
    return(
       <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/contacto" element={<Contacto />} />

        <Route path="/voluntario" element={
          <ProtectedRoute rolesPermitidos={[Rol.VOLUNTARIO, Rol.ADMIN]}>
            <VoluntarioPanel />
          </ProtectedRoute>
        } />

        <Route path="/colaborador" element={
          <ProtectedRoute rolesPermitidos={[Rol.COLABORADOR, Rol.ADMIN]}>
            <ColaboradorPanel />
          </ProtectedRoute>
        } />

        <Route path="/admin-dashboard" element={
          <ProtectedRoute rolesPermitidos={[Rol.ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/usuarios" element={
          <ProtectedRoute rolesPermitidos={[Rol.ADMIN]}>
            <RegistroUsuarios />
          </ProtectedRoute>
        } />

        <Route path="/colas" element={
          <ProtectedRoute rolesPermitidos={[Rol.ADMIN]}>
            <ColasPanel />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
    );
};