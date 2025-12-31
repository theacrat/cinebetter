import { DEFAULT_SETTINGS, decodeSettings } from "../shared/user-settings";
import { ConfigurePage } from "./ConfigurePage";
import {
	createRootRoute,
	createRoute,
	createRouter,
	Navigate,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
	component: () => <Outlet />,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: () => <Navigate to="/configure" replace />,
});

const configureRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/configure",
	component: () => <ConfigurePage initialSettings={DEFAULT_SETTINGS} />,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/$settings",
	component: () => {
		const { settings } = settingsRoute.useParams();
		return <Navigate to="/$settings/configure" params={{ settings }} replace />;
	},
});

const settingsConfigureRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/$settings/configure",
	component: () => {
		const { settings } = settingsConfigureRoute.useParams();
		try {
			return <ConfigurePage initialSettings={decodeSettings(settings)} />;
		} catch {
			return <Navigate to="/configure" replace />;
		}
	},
});

const catchAllRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "$",
	component: () => <Navigate to="/configure" replace />,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	configureRoute,
	settingsRoute,
	settingsConfigureRoute,
	catchAllRoute,
]);

const router = createRouter({
	routeTree,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	return <RouterProvider router={router} />;
}

export default App;
