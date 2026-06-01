import { Link } from "react-router-dom";

function HomeNewsCard({ item }) {
  return (
    <article className="newsCard">
      <img src={item.image} alt={item.title} className="newsCardImage" />
      <div className="newsCardBody">
        <div className="newsMeta">
          <span className="newsCategory">{item.category}</span>
          <span className="newsDate">{item.date}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <Link className="newsCardLink" to="/galeria" aria-label={`Ver más actividad sobre ${item.title}`}>
          Ver más
        </Link>
      </div>
    </article>
  );
}

export default HomeNewsCard;
