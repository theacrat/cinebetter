# Cinebetter

A Stremio add-on that provides true IMDb metadata.

## Cinemeta vs Cinebetter

Despite using IMDb IDs, Cinemeta actually relies on a variety of sources. This has lead to some cases of content not being available in it at all.

As an example, it is impossible find _Total Drama Action_ on Cinemeta due to differences in how sources handle the seasons of _Total Drama_. Anime is worst hit by this, since the other sources split seasons differently. _Hunter x Hunter_ (2011), for example, is only 1 season on IMDb, but Cinemeta returns it as 3.

Cinebetter replicates Cinemeta's functionality entirely, but with true IMDb data, to the point that it can be completely uninstalled and not cause issues. TMDB is only used for filtering low quality results from search.

## Setup

This was built primarily as a Cloudflare Worker using a D1 database, but it also supports running on Docker with Bun and a libSQL/SQLite database. CloudFlare's free Worker plan is quite restrictive on subrequests, so Docker is recommended for most self-hosters.

### Prerequisites

- [Bun](https://bun.sh/)
- A [TMDB API read access token](https://www.themoviedb.org/settings/api)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env and add your TMDB_TOKEN
```

### Development

```bash
# Generate GraphQL types and Prisma client
bun codegen
bun prisma-generate

# Create and migrate database
bun db:create

# Start development server
bun dev
```

Your application will be available at [http://localhost:5173](http://localhost:5173).

For watch mode during development:

```bash
# Terminal 1: Watch GraphQL codegen
bun codegen:watch

# Terminal 2: Watch Prisma client generation
bun prisma-generate:watch

# Terminal 3: Dev server
bun dev:bun
```

## Deployment

### Cloudflare Workers

1. Create a Cloudflare account and login.

```bash
bun wrangler login
```

2. Create a D1 database:

```bash
bun wrangler d1 create ImdbTmdb
```

3. Update [wrangler.jsonc](wrangler.jsonc) with your database ID

4. Set up environment variables:

```bash
bun wrangler secret put TMDB_TOKEN
```

5. Generate Cloudflare-specific Prisma client and run migrations:

```bash
bun prisma-generate
bun db:create
bun db:migrate
bun db:deploy
```

6. Deploy:

```bash
bun run build
bun run deploy
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Database Schema

### ImdbTmdb

Caches IMDb-to-TMDB ID mappings to reduce API calls:

| Column | Type        | Description                                 |
| ------ | ----------- | ------------------------------------------- |
| `imdb` | String (PK) | IMDb ID (e.g., "tt1234567")                 |
| `tmdb` | Int         | TMDB ID for matched content                 |
| `type` | Enum        | Match type: M (Movie), T (TV), N (No match) |

## Licence

Cinebetter

Copyright (C) 2025 thea

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

```
SPDX-License-Identifier: AGPL-3.0-or-later
```
