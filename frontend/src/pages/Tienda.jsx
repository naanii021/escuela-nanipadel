import { useMemo, useState } from "react";
import "./tienda.css";

const shopImage = (fileName) => `${process.env.PUBLIC_URL}/fotosTienda/${fileName}`;
const CLUB_EMAIL = "info@nanipadel.com";
const CLUB_WHATSAPP_NUMBER = "";

const SHOP_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "palas", label: "Palas" },
  { key: "overgrips", label: "Overgrips" },
  { key: "reparacion", label: "Reparacion" },
  { key: "ropa", label: "Ropa" },
  { key: "accesorios", label: "Accesorios" },
  { key: "servicios", label: "Otros servicios" },
];

const SHOP_ITEMS = [
  {
    id: 1,
    name: "Pala de control recomendada",
    category: "palas",
    categoryLabel: "Palas",
    type: "producto",
    typeLabel: "Producto",
    description: "Una pala equilibrada para alumnos que buscan control, comodidad y buena salida de bola.",
    longDescription: "Pensada para jugadores que quieren sentirse seguros desde el fondo de pista y mejorar la precision sin perder salida de bola. Es una opcion muy comoda para entrenar varias veces por semana.",
    price: "179 EUR",
    image: shopImage("pala-control.jpg"),
    featured: true,
    featuredLabel: "Recomendado por la escuela",
    badge: "Recomendado",
    details: [
      ["Nivel recomendado", "Iniciacion a medio"],
      ["Tipo de jugador", "Control y consistencia"],
      ["Sensacion", "Comoda, manejable y estable"],
      ["Uso", "Clases, partidos y progresion tecnica"],
    ],
  },
  {
    id: 2,
    name: "Pack de overgrips",
    category: "overgrips",
    categoryLabel: "Overgrips",
    type: "producto",
    typeLabel: "Producto",
    description: "Agarre comodo para entrenos y partidos, con buena sensacion en la mano.",
    longDescription: "Pack practico para renovar el agarre de la pala antes de entrenar o competir. Ayuda a jugar con mas seguridad cuando el grip empieza a perder tacto.",
    price: "9 EUR",
    image: shopImage("overgrips.jpg"),
    badge: "Producto de escuela",
    details: [
      ["Unidades", "Pack consultable en club"],
      ["Uso recomendado", "Entrenos y partidos"],
      ["Para quien", "Jugadores que quieren mejor agarre"],
    ],
  },
  {
    id: 3,
    name: "Reparacion y ajuste de pala",
    category: "reparacion",
    categoryLabel: "Reparacion",
    type: "servicio",
    typeLabel: "Servicio",
    description: "Revisamos desgaste, protector y pequenos ajustes para alargar la vida de tu pala.",
    longDescription: "Servicio para revisar el estado general de la pala, valorar pequenos ajustes y recomendar la mejor solucion antes de cambiar de material.",
    price: "Consultar",
    image: shopImage("reparacion-pala.jpg"),
    featuredLabel: "Servicio mas solicitado",
    badge: "Servicio del club",
    details: [
      ["Incluye", "Revision de desgaste y protector"],
      ["Solicitud", "Consulta previa con el club"],
      ["Recomendado para", "Palas con roces, golpes o perdida de tacto"],
    ],
  },
  {
    id: 4,
    name: "Sudadera oficial NaniPadel",
    category: "ropa",
    categoryLabel: "Ropa",
    type: "producto",
    typeLabel: "Producto",
    description: "Prenda comoda del club para entrenar, venir a clase o usar en el dia a dia.",
    longDescription: "Sudadera de estilo club, pensada para usar antes y despues de jugar o para venir a clase con una prenda comoda y reconocible de NaniPadel.",
    price: "42 EUR",
    image: shopImage("sudadera-club.jpg"),
    badge: "Producto de escuela",
    details: [
      ["Tallas", "Consultar disponibilidad"],
      ["Uso", "Entreno, calentamiento y dia a dia"],
      ["Disponibilidad", "Segun stock del club"],
    ],
  },
  {
    id: 5,
    name: "Mochila para pista",
    category: "accesorios",
    categoryLabel: "Accesorios",
    type: "producto",
    typeLabel: "Producto",
    description: "Espacio para pala, ropa y bote de bolas en un formato comodo para venir al club.",
    longDescription: "Mochila funcional para llevar lo necesario a pista sin cargar con un paletero grande. Buena opcion para alumnos que vienen directos a clase o partido.",
    price: "59 EUR",
    image: shopImage("mochila-padel.jpg"),
    badge: "Accesorio",
    details: [
      ["Capacidad", "Pala, ropa y accesorios"],
      ["Uso recomendado", "Clases y partidos"],
      ["Para quien", "Jugadores que buscan comodidad"],
    ],
  },
  {
    id: 6,
    name: "Asesoramiento de material",
    category: "servicios",
    categoryLabel: "Otros servicios",
    type: "servicio",
    typeLabel: "Servicio",
    description: "Te orientamos para elegir pala, grip y accesorios segun tu nivel y forma de jugar.",
    longDescription: "Te ayudamos a elegir material con criterio: nivel, frecuencia de juego, sensaciones que buscas y presupuesto. Ideal si no sabes que pala o accesorio te encaja.",
    price: "Consultar",
    image: shopImage("material-padel.jpg"),
    badge: "Servicio del club",
    details: [
      ["Incluye", "Orientacion personalizada"],
      ["Para quien", "Alumnos y jugadores del club"],
      ["Solicitud", "Contactar con el club"],
    ],
  },
];

function formatPrice(price) {
  if (!price) return "Consultar";
  return String(price).replace(/\s*EUR$/i, " EUR");
}

function contactHref(item) {
  const text = `Hola, estoy interesado en ${item.name} de la tienda NaniPadel.`;
  if (CLUB_WHATSAPP_NUMBER) {
    return `https://wa.me/${CLUB_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  }
  return `mailto:${CLUB_EMAIL}?subject=${encodeURIComponent(`Tienda NaniPadel - ${item.name}`)}&body=${encodeURIComponent(text)}`;
}

function Tienda() {
  const [activeFilter, setActiveFilter] = useState("todas");
  const [selectedItem, setSelectedItem] = useState(null);

  const featuredItem = SHOP_ITEMS.find((item) => item.featured) || SHOP_ITEMS[0];

  const filteredItems = useMemo(() => {
    if (activeFilter === "todas") return SHOP_ITEMS;
    return SHOP_ITEMS.filter((item) => item.category === activeFilter);
  }, [activeFilter]);

  const productCount = SHOP_ITEMS.filter((item) => item.type === "producto").length;
  const serviceCount = SHOP_ITEMS.filter((item) => item.type === "servicio").length;

  return (
    <section className="tienda">
      <section className="tiendaHero">
        <div className="tiendaHeroCopy">
          <span className="tiendaEyebrow">Club y material</span>
          <h1>Tienda</h1>
          <p className="tiendaLead">
            Material, ropa y servicios utiles para alumnos y jugadores del club. Si tienes dudas,
            pregunta en la escuela antes de comprar.
          </p>
        </div>

        <div className="tiendaHeroPanel">
          <div className="tiendaMiniStat">
            <span>Productos</span>
            <strong>{productCount}</strong>
          </div>
          <div className="tiendaMiniStat">
            <span>Servicios</span>
            <strong>{serviceCount}</strong>
          </div>
          <div className="tiendaMiniStat tiendaMiniStatWide">
            <span>Estilo NaniPadel</span>
            <strong>Material y ayuda para elegir bien</strong>
          </div>
        </div>
      </section>

      <section className="tiendaFeatured">
        <div className="tiendaFeaturedMedia">
          <img src={featuredItem.image} alt={featuredItem.name} loading="lazy" />
        </div>
        <div className="tiendaFeaturedBody">
          <span className="tiendaSectionEyebrow">{featuredItem.featuredLabel}</span>
          <h2>{featuredItem.name}</h2>
          <p>{featuredItem.description}</p>
          <div className="tiendaFeaturedMeta">
            <span className="shopBadge">{featuredItem.categoryLabel}</span>
            <span className="shopBadge shopBadgeType">{featuredItem.typeLabel}</span>
            <strong>{formatPrice(featuredItem.price)}</strong>
          </div>
          <div className="tiendaFeaturedActions">
            <button type="button" className="shopPrimaryBtn" onClick={() => setSelectedItem(featuredItem)}>Ver detalles</button>
            <a className="shopSecondaryBtn" href={contactHref(featuredItem)}>Contactar</a>
          </div>
        </div>
      </section>

      <section className="tiendaControls">
        <div className="tiendaControlsHead">
          <div>
            <span className="tiendaSectionEyebrow">Catalogo</span>
            <h3>Material y servicios del club</h3>
          </div>
          <p>
            Filtra por categoria para encontrar palas, grips, mochila o servicios de la escuela.
          </p>
        </div>

        <div className="tiendaFilters" role="tablist" aria-label="Filtros de tienda">
          {SHOP_FILTERS.map((filter) => (
            <button
              key={filter.key}
              className={`tiendaFilter${activeFilter === filter.key ? " isActive" : ""}`}
              onClick={() => setActiveFilter(filter.key)}
              role="tab"
              aria-selected={activeFilter === filter.key}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="tiendaGridSection">
        {filteredItems.length ? (
          <div className="tiendaGrid">
            {filteredItems.map((item) => (
              <article className={`shopCard shopCard-${item.type}`} key={item.id} onClick={() => setSelectedItem(item)}>
                <div className="shopCardMedia">
                  <img src={item.image} alt={item.name} loading="lazy" />
                </div>
                <div className="shopCardBody">
                  <div className="shopCardBadges">
                    <span className="shopBadge">{item.categoryLabel}</span>
                    <span className="shopBadge shopBadgeType">{item.typeLabel}</span>
                    <span className="shopBadge shopBadgeSoft">{item.badge || (item.type === "servicio" ? "Servicio del club" : "Producto de escuela")}</span>
                  </div>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                  <div className="shopCardFooter">
                    <strong>{formatPrice(item.price)}</strong>
                    <span>{item.type === "servicio" ? "Servicio del club" : "Producto de escuela"}</span>
                  </div>
                  <div className="shopCardActions">
                    <button
                      type="button"
                      className="shopPrimaryBtn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedItem(item);
                      }}
                    >
                      Ver detalles
                    </button>
                    <a
                      className="shopSecondaryBtn"
                      href={contactHref(item)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Contactar
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tiendaEmpty">No hay productos disponibles en esta categoria por ahora.</div>
        )}
      </section>

      {selectedItem && (
        <div className="shopModalBackdrop" role="presentation" onClick={() => setSelectedItem(null)}>
          <section
            className="shopModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="shopModalClose" onClick={() => setSelectedItem(null)} aria-label="Cerrar detalle">x</button>
            <div className="shopModalMedia">
              <img src={selectedItem.image} alt={selectedItem.name} />
            </div>
            <div className="shopModalBody">
              <div className="shopModalHead">
                <div>
                  <div className="shopCardBadges">
                    <span className="shopBadge">{selectedItem.categoryLabel}</span>
                    <span className="shopBadge shopBadgeType">{selectedItem.typeLabel}</span>
                    <span className="shopBadge shopBadgeSoft">{selectedItem.badge || "NaniPadel"}</span>
                  </div>
                  <h2 id="shop-modal-title">{selectedItem.name}</h2>
                </div>
                <strong>{formatPrice(selectedItem.price)}</strong>
              </div>
              <p>{selectedItem.longDescription || selectedItem.description}</p>
              <div className="shopModalInfo">
                {(selectedItem.details || []).map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="shopModalActions">
                <a className="shopPrimaryBtn" href={contactHref(selectedItem)}>
                  {selectedItem.type === "servicio" ? "Solicitar servicio" : "Solicitar producto"}
                </a>
                <a className="shopSecondaryBtn" href={contactHref(selectedItem)}>Contactar con el club</a>
              </div>
              <small>No hay pasarela de pago activa; la solicitud se gestiona directamente con el club.</small>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default Tienda;
