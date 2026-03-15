import { useEffect, useState } from 'react';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import {AuthProvider} from './context/auth/AuthProvider.tsx';
import {AuthPage} from './components/AuthPage.tsx';
import {AdminPanel} from './components/AdminPanel';
import StatusErrorPage from './components/StatusErrorPage';
import {ExpertPanel} from './components/ExpertPanel';
import {ContentPanel} from './components/ContentPanel.tsx';
import {ThemeProvider} from './context/theme/ThemeProvider.tsx';
import {RoleProtectedRoute} from './components/RoleProtectedRoute';
import {UserRoleEnum} from './api';
import {ProfileProvider} from "./context/profile/ProfileProvider.tsx";
import {ContentProvider} from "./context/content/ContentProvider.tsx";
import {AdminProvider} from "./context/admin/AdminProvider.tsx";
import {ExpertProvider} from "./context/expert/ExpertProvider.tsx";
import { API_ERROR_EVENT } from './utils/apiError';

const GlobalApiErrorBanner = () => {
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let timeoutId: number | null = null;

        const handleApiError = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            const nextMessage = customEvent.detail;
            if (!nextMessage) return;

            setMessage(nextMessage);
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
            timeoutId = window.setTimeout(() => {
                setMessage(null);
            }, 5000);
        };

        window.addEventListener(API_ERROR_EVENT, handleApiError as EventListener);
        return () => {
            window.removeEventListener(API_ERROR_EVENT, handleApiError as EventListener);
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []);

    if (!message) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 16,
                right: 16,
                zIndex: 3000,
                maxWidth: 420,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff1f0",
                border: "1px solid #ffb3ad",
                color: "#b42318",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                whiteSpace: "pre-wrap",
            }}
        >
            {message}
        </div>
    );
};

export const App = () => (
    <ThemeProvider>
        <AuthProvider>
            <ProfileProvider>
                <ContentProvider>
                    <AdminProvider>
                        <ExpertProvider>
                            <BrowserRouter>
                                <GlobalApiErrorBanner />
                                <Routes>
                                    <Route path="/" element={<AuthPage/>}/>
                                    <Route path="/status-error" element={<StatusErrorPage/>} />
                                    <Route
                                        path="/admin"
                                        element={
                                            <RoleProtectedRoute allowedRole={UserRoleEnum.Admin}>
                                                <AdminPanel/>
                                            </RoleProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/expert"
                                        element={
                                            <RoleProtectedRoute allowedRole={UserRoleEnum.Expert}>
                                                <ExpertPanel/>
                                            </RoleProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/content"
                                        element={
                                            <RoleProtectedRoute allowedRole={UserRoleEnum.ContentModerator}>
                                                <ContentPanel/>
                                            </RoleProtectedRoute>
                                        }
                                    />
                                </Routes>
                            </BrowserRouter>
                        </ExpertProvider>
                    </AdminProvider>
                </ContentProvider>
            </ProfileProvider>
        </AuthProvider>
    </ThemeProvider>
);
export default App;
