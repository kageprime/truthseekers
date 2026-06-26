export default function MapsLoading() {
  return (
    <div className="fixed inset-0 bg-[#0b0906] flex items-center justify-center" style={{ fontFamily: "Cinzel, serif" }}>
      <div style={{ color: "#f0ddb3", fontSize: 14, letterSpacing: 3, textTransform: "uppercase", opacity: 0.6 }}>
        Loading Atlas…
      </div>
    </div>
  );
}
