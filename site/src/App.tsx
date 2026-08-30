import { type FormEvent, useState } from "react";
import {
  authMode,
  completeNewPassword,
  confirmPasswordReset,
  requestPasswordReset,
  signIn,
  type AuthenticatedUser,
  type NewPasswordChallenge,
} from "./lib/auth";

type View = "login" | "forgot" | "confirm-reset" | "new-password" | "success";

const errorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "Não foi possível concluir a solicitação agora.";
};

const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export default function App() {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [challenge, setChallenge] = useState<NewPasswordChallenge | null>(null);

  const resetFeedback = () => setError("");

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!validEmail(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos seis caracteres.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      if (result.status === "new-password-required") {
        setChallenge(result.challenge);
        setNewPassword("");
        setView("new-password");
      } else {
        setUser(result.user);
        setView("success");
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!validEmail(email)) {
      setError("Informe o e-mail usado no seu cadastro.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setView("confirm-reset");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!confirmationCode.trim()) {
      setError("Informe o código de confirmação.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha deve ter pelo menos oito caracteres.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(email.trim().toLowerCase(), confirmationCode, newPassword);
      setPassword("");
      setView("login");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();

    if (!challenge) {
      setView("login");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha deve ter pelo menos oito caracteres.");
      return;
    }

    setLoading(true);
    try {
      const authenticatedUser = await completeNewPassword(challenge, newPassword);
      setUser(authenticatedUser);
      setView("success");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const returnToLogin = () => {
    resetFeedback();
    setConfirmationCode("");
    setNewPassword("");
    setView("login");
  };

  return (
    <main className="login-page">
      <div className="page-grid" aria-hidden="true" />
      <div className="orbit orbit-one" aria-hidden="true" />
      <div className="orbit orbit-two" aria-hidden="true" />

      <header className="login-header">
        <a className="brand" href="/" aria-label="Foundation Market, início">
          <span className="brand-mark">R</span>
          <span className="brand-copy">
            <strong>Residência</strong>
            <small>Foundation Market</small>
          </span>
        </a>
        <div className="lab-status">
          <span className="status-dot" />
          Acesso seguro
        </div>
      </header>

      <section className="login-story" aria-labelledby="story-title">
        <div className="story-code">FOUNDATION MARKET</div>
        <h1 id="story-title">
          Compre com facilidade.
          <em>Venda com propósito.</em>
        </h1>
        <p>
          Um marketplace construído por etapas. Produtos, pedidos e estoque vão
          evoluir sobre uma base que você entende de ponta a ponta.
        </p>

        <div className="journey-line" aria-label="Evolução do marketplace">
          <div className="journey-item journey-item-active">
            <span>01</span>
            <strong>Acesso</strong>
          </div>
          <div className="journey-item">
            <span>02</span>
            <strong>Catálogo</strong>
          </div>
          <div className="journey-item">
            <span>03</span>
            <strong>Pedidos</strong>
          </div>
        </div>

        <div className="story-footer">
          <span>Produtos</span>
          <span>Pedidos</span>
          <span>Estoque</span>
        </div>
      </section>

      <section className="access-panel" aria-label="Acesso à plataforma">
        <div className="panel-topline">
          <span><i /> Portal de acesso</span>
          <span>{authMode === "mock" ? "Modo mock" : "Cognito"}</span>
        </div>

        <div className="panel-content">
          {view === "login" && (
            <form onSubmit={handleLogin} noValidate>
              <div className="form-heading">
                <span>Acesso individual</span>
                <h2>Entre na sua conta.</h2>
                <p>Use as credenciais vinculadas ao marketplace.</p>
              </div>

              <label className="field">
                <span>E-mail</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  placeholder="voce@exemplo.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="field">
                <span className="field-row">
                  <b>Senha</b>
                  <button type="button" onClick={() => { resetFeedback(); setView("forgot"); }}>
                    Esqueci minha senha
                  </button>
                </span>
                <span className="password-control">
                  <input
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </span>
              </label>

              <label className="remember-control">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span aria-hidden="true" />
                Lembrar neste dispositivo
              </label>

              {error && <p className="form-error" role="alert">{error}</p>}

              <button className="submit-button" type="submit" disabled={loading}>
                <span>{loading ? "Validando acesso" : "Acessar marketplace"}</span>
                <b aria-hidden="true">→</b>
              </button>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgotPassword} noValidate>
              <div className="form-heading">
                <span>Recuperação de acesso</span>
                <h2>Recupere sua senha.</h2>
                <p>Enviaremos um código de confirmação para o seu e-mail.</p>
              </div>
              <label className="field">
                <span>E-mail</span>
                <input
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  placeholder="voce@exemplo.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-button" type="submit" disabled={loading}>
                <span>{loading ? "Enviando código" : "Enviar código"}</span>
                <b aria-hidden="true">→</b>
              </button>
              <button className="back-button" type="button" onClick={returnToLogin}>Voltar ao login</button>
            </form>
          )}

          {view === "confirm-reset" && (
            <form onSubmit={handleConfirmReset} noValidate>
              <div className="form-heading">
                <span>Nova credencial</span>
                <h2>Defina uma nova senha.</h2>
                <p>Informe o código enviado para {email}.</p>
              </div>
              <label className="field">
                <span>Código de confirmação</span>
                <input
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder="000000"
                  value={confirmationCode}
                  onChange={(event) => setConfirmationCode(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Nova senha</span>
                <input
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-button" type="submit" disabled={loading}>
                <span>{loading ? "Salvando senha" : "Confirmar nova senha"}</span>
                <b aria-hidden="true">→</b>
              </button>
              <button className="back-button" type="button" onClick={returnToLogin}>Voltar ao login</button>
            </form>
          )}

          {view === "new-password" && (
            <form onSubmit={handleNewPassword} noValidate>
              <div className="form-heading">
                <span>Primeiro acesso</span>
                <h2>Crie sua senha.</h2>
                <p>Substitua a senha temporária antes de continuar.</p>
              </div>
              <label className="field">
                <span>Nova senha</span>
                <input
                  autoFocus
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-button" type="submit" disabled={loading}>
                <span>{loading ? "Ativando acesso" : "Criar senha e acessar"}</span>
                <b aria-hidden="true">→</b>
              </button>
            </form>
          )}

          {view === "success" && (
            <div className="success-state" role="status">
              <div className="form-heading">
                <span>Acesso validado</span>
                <h2>Bem-vindo ao marketplace.</h2>
                <p>{user?.email} está pronto para continuar.</p>
              </div>
              <div className="success-message">
                O catálogo será conectado nas próximas etapas da Trilha Foundation.
              </div>
              <button className="back-button" type="button" onClick={() => { setUser(null); setPassword(""); returnToLogin(); }}>
                Voltar ao login
              </button>
            </div>
          )}
        </div>

        <div className="panel-footer">
          <span>Ambiente seguro</span>
          <span>Foundation / 2026</span>
        </div>
      </section>
    </main>
  );
}
