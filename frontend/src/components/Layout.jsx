import Header from "./Header";
import Footer from "./Footer";
import ClubAssistant from "./ClubAssistant";
import "./layout.css";

// Layout general que envuelve las páginas
function Layout({ children }) {
  return (
    <div className="appShell">
      <Header />

      {/* Contenido principal */}
      <main className="main">
        <div className="container">{children}</div>
      </main>

      <Footer />
      <ClubAssistant />
    </div>
  );
}

export default Layout;
