import { cookies } from "next/headers";

export async function getUser() {
    console.log("Hit getUser from Next Server")
    const res = await fetch(`${process.env.APP_URL}/api/v1/me`, {
        headers: {
            Cookie: cookies().toString(),
        },
        cache: "no-store",
    });
    console.log("res ",res )

    if (!res.ok) return null;
    return res.json();
}
