import { createFileRoute, Navigate } from "@tanstack/react-router";
import type { JSX } from "react";

export const Route = createFileRoute("/")({ component: IndexComponent });

function IndexComponent(): JSX.Element {
	return <Navigate to="/{-$settings}/configure" replace />;
}
