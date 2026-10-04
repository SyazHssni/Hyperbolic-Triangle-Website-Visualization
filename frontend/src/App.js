import "@/App.css";
import HyperbolicExplorer from "@/components/HyperbolicExplorer";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <HyperbolicExplorer />
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
