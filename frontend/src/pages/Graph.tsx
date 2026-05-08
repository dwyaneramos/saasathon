import GraphView from "@/components/GraphView";

export default function Graph() {
  return (
    <div className="relative text-primary h-screen bg-bg flex flex-col justify-center overflow-hidden">
      <div className="absolute inset-0 left-32 z-0">
        <GraphView></GraphView>
      </div>

      <div className="relative z-10 pl-20"></div>
    </div>
  );
}
