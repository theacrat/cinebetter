import App from "./App.tsx";
import "./index.css";
import { Provider, defaultTheme } from "@adobe/react-spectrum";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Provider theme={defaultTheme} colorScheme="dark">
			<App />
		</Provider>
	</StrictMode>,
);
