This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

### Environment Variables

When deploying to Vercel, you need to set the following environment variables in your Vercel project settings:

1. **NEXT_PUBLIC_CODEBASE** - Set to `"production"` for production deployments
2. **NEXT_PUBLIC_APP_URL** - Your user API URL (e.g., `https://your-user-api.vercel.app`)
3. **NEXT_PUBLIC_CHAT_API_URL** - Your chat API URL (e.g., `https://your-chat-api.vercel.app`)

### Vercel Configuration

The project includes a `vercel.json` file in the root directory that configures Vercel to:
- Use `fe/` as the root directory
- Install dependencies using `pnpm`
- Build the Next.js application

### Local Development Environment Variables

For local development, create a `.env.local` file in the `fe/` directory:

```
NEXT_PUBLIC_CODEBASE=development
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_CHAT_API_URL=http://localhost:3002
```

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
