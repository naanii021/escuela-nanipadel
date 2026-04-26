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
        <strong>{item.title}</strong>
        <p>{item.summary}</p>
        <Link className="newsCardLink" to="/galeria">
          Ver mas
        </Link>
      </div>
    </article>
  );
}

export default HomeNewsCard;
