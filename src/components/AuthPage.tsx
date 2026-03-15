import React, {useState, useEffect, useCallback} from "react";
import {useNavigate} from "react-router-dom";
import {UserRoleEnum, UserSystemLanguageEnum, StaffRegisterRequestRoleEnum} from "../api";
import {useAuth} from "../context/auth/UseAuth";
import {useTheme} from "../context/theme/UseTheme.tsx";
import {ThemeSwitcher} from "./shared/ThemeSwitcher.tsx";
import {getApiErrorMessage} from "../utils/apiError";

export const AuthPage = () => {
    const [mode, setMode] = useState<"login" | "register">("login");
    const {theme, toggle} = useTheme();
    const [role, setRole] = useState<UserRoleEnum | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const systemLanguage = UserSystemLanguageEnum.Russian
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const {login, registerWithStaffProfile, user} = useAuth();
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [patronymic, setPatronymic] = useState("");

    const navigate = useNavigate();

    // Validation helpers aligned with backend constraints
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+\d{1,3}[-\s]?\d{1,14}([-\s]?\d{1,13})?$/;

    const getRegistrationValidationErrors = () => {
        const errs: string[] = [];
        // Email
        if (!emailRegex.test(email)) {
            errs.push("Некорректный email"); // {email.invalid}
        }
        // Password: min 6, contains digit, contains one of !@#$%^&*()_
        if (password.length < 6) {
            errs.push("Пароль должен быть не короче 6 символов"); // {password.min}
        }
        if (!/\d/.test(password)) {
            errs.push("Пароль должен содержать хотя бы одну цифру"); // {password.digit}
        }
        if (!/[!@#$%^&*()_]/.test(password)) {
            errs.push("Пароль должен содержать хотя бы один спецсимвол"); // {password.special}
        }
        // Phone (required for registration)
        const phoneValue = phone.trim();
        if (phoneValue.length === 0) {
            errs.push("Телефон обязателен");
        } else if (!phoneRegex.test(phoneValue)) {
            errs.push("Некорректный формат телефона"); // {phone.invalid}
        }
        // Role required for staff registration
        if (mode === "register" && !role) {
            errs.push("Пожалуйста, выберите роль");
        }
        return errs;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (mode === "login") {
                const roleAfter = await login(email, password);
                // Decode status directly from freshly stored token to avoid race with state update
                const token = localStorage.getItem('accessToken');
                let status: string | undefined;
                if (token) {
                    const parts = token.split('.');
                    if (parts.length >= 2) {
                        try {
                            const base64 = parts[1].replace(/-/g,'+').replace(/_/g,'/');
                            const json = atob(base64);
                            const payload = JSON.parse(json);
                            status = payload.status;
                        } catch { /* ignore */ }
                    }
                }
                
                if (status && status !== 'ACTIVE') {
                    navigate('/status-error', { state: { status } });
                    return;
                }
                if (!roleAfter) {
                    setError("Не удалось получить роль пользователя");
                    setIsLoading(false);
                    return;
                }
                redirectToPanel(roleAfter);
            } else {
                // Validate registration fields according to backend rules
                const errs = getRegistrationValidationErrors();
                if (errs.length > 0) {
                    setError(errs.join("\n"));
                    setIsLoading(false);
                    return;
                }
                const selectedRole = role as unknown as StaffRegisterRequestRoleEnum; // validated above
                const userRole = await registerWithStaffProfile(
                    {email, password, phone, role: selectedRole, systemLanguage, name, surname},
                    {name, surname, patronymic}
                );
                redirectToPanel(userRole);
            }
        } catch (err: unknown) {
            console.error("Auth error:", err);
            setError(getApiErrorMessage(err, "Произошла ошибка авторизации."));
        } finally {
            setIsLoading(false);
        }
    };

    const redirectToPanel = useCallback(
        (userRole: UserRoleEnum) => {
            switch (userRole) {
                case UserRoleEnum.Admin:
                    navigate("/admin");
                    break;
                case UserRoleEnum.Expert:
                    navigate("/expert");
                    break;
                case UserRoleEnum.ContentModerator:
                    navigate("/content");
                    break;
                default:
                    navigate("/");
            }
        },
        [navigate]
    );

    useEffect(() => {
        if (user?.role) {
            if (user.status && user.status !== 'ACTIVE') {
                navigate('/status-error', { state: { status: user.status } });
            } else {
                redirectToPanel(user.role as UserRoleEnum);
            }
        }
    }, [redirectToPanel, user, navigate]);

    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                background: "var(--color-bg)",
                color: "var(--color-text)",
                margin: 0,
                padding: 0,
                boxSizing: "border-box",
            }}
        >
            <header
                style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "24px 32px",
                    borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    boxSizing: "border-box",
                }}
            >
                <div style={{display: "flex", alignItems: "center"}}>
                    <img
                        src={theme === 'light' ? "/assets/WhiteThemeIcon.png" : "/assets/inRussian.png"}
                        alt="На русском"
                        style={{ height: "2.5rem", marginRight: "0.5rem" }}
                    />
                </div>
                <ThemeSwitcher theme={theme} toggle={toggle}/>
            </header>
            <main
                style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100vw",
                }}
            >
                <form
                    onSubmit={handleSubmit}
                    style={{
                        width: "100%",
                        maxWidth: "460px",
                        padding: "28px",
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "16px",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    <h2
                        style={{
                            textAlign: "center",
                            marginBottom: "32px",
                            fontWeight: 700,
                            fontSize: "1.4rem",
                        }}
                    >
                        {mode === "login" ? "Вход в систему" : "Регистрация"}
                    </h2>

                    {mode === "register" && (
                        <div style={{marginBottom: "15px", width: "100%"}}>
                            <label style={{display: "block", marginBottom: "8px"}}>
                                Роль:
                            </label>
                            <div
                                style={{
                                    display: "flex",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    border: "1px solid var(--color-border)",
                                    background: "var(--color-card)",
                                    width: "100%",
                                }}
                            >
                                {[
                                    {value: UserRoleEnum.Admin, label: "Администратор"},
                                    {value: UserRoleEnum.Expert, label: "Эксперт"},
                                    {value: UserRoleEnum.ContentModerator, label: "Менеджер"},
                                ].map(({value, label}, idx, arr) => {
                                    let borderRadius = "0";
                                    if (idx === 0) borderRadius = "12px 0 0 12px";
                                    if (idx === arr.length - 1) borderRadius = "0 12px 12px 0";
                                    const borderColor =
                                        role === value
                                            ? "var(--color-primary)"
                                            : "var(--color-border)";
                                    return (
                                        <React.Fragment key={value}>
                                            <button
                                                type="button"
                                                onClick={() => setRole(value)}
                                                style={{
                                                    flex: 1,
                                                    padding: "12px 0",
                                                    background:
                                                        role === value
                                                            ? "var(--color-primary)"
                                                            : "transparent",
                                                    color: role === value ? "#fff" : "var(--color-text)",
                                                    border: `1px solid ${borderColor}`,
                                                    borderRadius,
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    transition:
                                                        "background 0.2s, color 0.2s, border-color 0.2s",
                                                    outline: "none",
                                                }}
                                            >
                                                {label}
                                            </button>
                                            {idx < arr.length - 1 && (
                                                <div
                                                    style={{
                                                        width: "1px",
                                                        background: "rgba(120,120,120,0.3)",
                                                        alignSelf: "stretch",
                                                    }}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{marginBottom: "15px", width: "100%"}}>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Email"
                            style={{
                                width: "100%",
                                minWidth: "0",
                                boxSizing: "border-box",
                                padding: "8px",
                                border: "1px solid var(--color-border)",
                                borderRadius: "4px",
                                background: "var(--color-card)",
                                color: "var(--color-text)",
                            }}
                        />
                    </div>

                    <div style={{marginBottom: "15px", width: "100%"}}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Пароль"
                            style={{
                                width: "100%",
                                minWidth: "0",
                                boxSizing: "border-box",
                                padding: "8px",
                                border: "1px solid var(--color-border)",
                                borderRadius: "4px",
                                background: "var(--color-card)",
                                color: "var(--color-text)",
                            }}
                        />
                    </div>

                    {mode === "register" && (
                        <>
                <div style={{marginBottom: "15px", width: "100%"}}>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="Телефон"
                                    style={{
                                        width: "100%",
                                        minWidth: "0",
                                        boxSizing: "border-box",
                                        padding: "8px",
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "4px",
                                        background: "var(--color-card)",
                                        color: "var(--color-text)",
                                    }}
                                />
                            </div>
                            <div style={{marginBottom: "15px", width: "100%"}}>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Имя"
                                    style={{
                                        width: "100%",
                                        minWidth: "0",
                                        boxSizing: "border-box",
                                        padding: "8px",
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "4px",
                                        background: "var(--color-card)",
                                        color: "var(--color-text)",
                                    }}
                                />
                            </div>
                            <div style={{marginBottom: "15px", width: "100%"}}>
                                <input
                                    type="text"
                                    value={surname}
                                    onChange={(e) => setSurname(e.target.value)}
                                    required
                                    placeholder="Фамилия"
                                    style={{
                                        width: "100%",
                                        minWidth: "0",
                                        boxSizing: "border-box",
                                        padding: "8px",
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "4px",
                                        background: "var(--color-card)",
                                        color: "var(--color-text)",
                                    }}
                                />
                            </div>
                            <div style={{marginBottom: "15px", width: "100%"}}>
                                <input
                                    type="text"
                                    value={patronymic}
                                    onChange={(e) => setPatronymic(e.target.value)}
                                    placeholder="Отчество"
                                    style={{
                                        width: "100%",
                                        minWidth: "0",
                                        boxSizing: "border-box",
                                        padding: "8px",
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "4px",
                                        background: "var(--color-card)",
                                        color: "var(--color-text)",
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {error && (
                        <div
                            style={{
                                marginBottom: "15px",
                                padding: "10px",
                                backgroundColor: "#f8d7da",
                                color: "#721c24",
                                borderRadius: "4px",
                                width: "100%",
                                whiteSpace: "pre-line",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: "80%",
                            padding: "12px",
                            backgroundColor: "var(--color-primary)",
                            color: "#fff", // всегда белый текст
                            border: "none",
                            outline: "none",
                            borderRadius: "4px",
                            cursor: isLoading ? "not-allowed" : "pointer",
                            opacity: isLoading ? 0.6 : 1,
                            margin: "0 auto",
                            fontWeight: 600,
                        }}
                    >
                        {isLoading
                            ? "Загрузка..."
                            : mode === "login"
                                ? "Войти"
                                : "Зарегистрироваться"}
                    </button>

                    <div
                        style={{marginTop: "18px", textAlign: "center", width: "100%"}}
                    >
                        {mode === "login" ? (
                            <span>
                Нет аккаунта?
                <button
                    type="button"
                    onClick={() => setMode("register")}
                    style={{
                        background: "none",
                        outline: "none",
                        border: "none",
                        color: "var(--color-primary)",
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontSize: "1rem",
                    }}
                >
                  Зарегистрироваться
                </button>
              </span>
                        ) : (
                            <span>
                Уже есть аккаунт?
                <button
                    type="button"
                    onClick={() => setMode("login")}
                    style={{
                        background: "none",
                        outline: "none",
                        border: "none",
                        color: "var(--color-primary)",
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontSize: "1rem",
                    }}
                >
                  Войти
                </button>
              </span>
                        )}
                    </div>
                </form>
            </main>
        </div>
    );
};
