import LandingAnimation from "@/components/LandingAnimation";

export const Landing = () => {
  return (
    <div className="relative text-primary h-screen bg-bg flex flex-col justify-center overflow-hidden">
      
      <div className="absolute inset-0 left-32 z-0">
        <LandingAnimation />
      </div>

      <div className="relative z-10 pl-20">
        <h1 className="text-9xl">Kibi</h1>

        <h2 className="text-6xl">
          What your life <span className="italic">'kibi'</span>
        </h2>

        <button className="bg-primary w-48 rounded-full my-3 text-bg text-3xl px-6 py-3">
          Get started
        </button>
      </div>
    </div>
  );
};

export default Landing;