import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

type DocumentData<TDocument> =
	TDocument extends TypedDocumentNode<infer TData, infer _TVariables> ? TData : never;

type DocumentVariables<TDocument> =
	TDocument extends TypedDocumentNode<infer _TData, infer TVariables> ? TVariables : never;

export type { DocumentData, DocumentVariables };
