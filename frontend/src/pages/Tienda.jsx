import { useMemo, useState } from "react";
import "./tienda.css";

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
    name: "Pala de control club edition",
    category: "palas",
    categoryLabel: "Palas",
    type: "producto",
    typeLabel: "Producto",
    description: "Modelo equilibrado para alumnos que buscan control, comodidad y buena salida de bola.",
    price: "179 EUR",
    image:
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    featuredLabel: "Recomendado por la escuela",
  },
  {
    id: 2,
    name: "Pack overgrips rendimiento",
    category: "overgrips",
    categoryLabel: "Overgrips",
    type: "producto",
    typeLabel: "Producto",
    description: "Pack de agarre comodo y duradero para mantener sensacion seca en entrenos y partidos.",
    price: "9 EUR",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 3,
    name: "Reparacion y ajuste de pala",
    category: "reparacion",
    categoryLabel: "Reparacion",
    type: "servicio",
    typeLabel: "Servicio",
    description: "Revision de desgaste, cambio de protector y puesta a punto para alargar la vida de tu pala.",
    price: "Consultar",
    image:
      "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
    featuredLabel: "Servicio mas solicitado",
  },
  {
    id: 4,
    name: "Sudadera oficial NaniPadel",
    category: "ropa",
    categoryLabel: "Ropa",
    type: "producto",
    typeLabel: "Producto",
    description: "Prenda del club para entreno y uso diario con imagen limpia y comoda.",
    price: "42 EUR",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 5,
    name: "Mochila de pista",
    category: "accesorios",
    categoryLabel: "Accesorios",
    type: "producto",
    typeLabel: "Producto",
    description: "Espacio para pala, ropa y bote de bolas con formato comodo para venir al club.",
    price: "59 EUR",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 6,
    name: "Asesoramiento de material",
    category: "servicios",
    categoryLabel: "Otros servicios",
    type: "servicio",
    typeLabel: "Servicio",
    description: "Te ayudamos a elegir pala, grip y accesorios segun tu nivel, ritmo de juego y objetivos.",
    price: "Consultar",
    image:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
  },
];

function Tienda() {
  const [activeFilter, setActiveFilter] = useState("todas");

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
            Un escaparate de productos y servicios de la escuela: material, ropa, accesorios y
            soluciones utiles para alumnos y jugadores del club.
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
            <strong>Material, asesoramiento y club</strong>
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
            <strong>{featuredItem.price}</strong>
          </div>
        </div>
      </section>

      <section className="tiendaControls">
        <div className="tiendaControlsHead">
          <div>
            <span className="tiendaSectionEyebrow">Catalogo</span>
            <h3>Productos y servicios del club</h3>
          </div>
          <p>
            Filtra rapido por categoria y distingue al momento entre material fisico y servicios de
            la escuela.
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
        <div className="tiendaGrid">
          {filteredItems.map((item) => (
            <article className={`shopCard shopCard-${item.type}`} key={item.id}>
              <div className="shopCardMedia">
                <img src={item.image} alt={item.name} loading="lazy" />
              </div>
              <div className="shopCardBody">
                <div className="shopCardBadges">
                  <span className="shopBadge">{item.categoryLabel}</span>
                  <span className="shopBadge shopBadgeType">{item.typeLabel}</span>
                </div>
                <h4>{item.name}</h4>
                <p>{item.description}</p>
                <div className="shopCardFooter">
                  <strong>{item.price || "Consultar"}</strong>
                  <span>{item.type === "servicio" ? "Servicio del club" : "Producto de escuela"}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default Tienda;
