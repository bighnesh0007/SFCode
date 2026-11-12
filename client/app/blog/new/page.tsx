"use client";

import { useRouter } from "next/navigation";
import { SignInButton, useAuthState } from "@/components/auth";
import { PostEditor } from "@/components/PostEditor";
import { Button } from "@/components/ui/button";
import { createPost } from "@/lib/blogApi";

export default function NewPost() {
  const { isLoaded, isSignedIn, getToken } = useAuthState();
  const router = useRouter();
  if (isLoaded && !isSignedIn)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <p className="text-muted-foreground">Sign in to write a post.</p>
        <SignInButton><Button>Sign in</Button></SignInButton>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New post</h1>
      <PostEditor
        submitLabel="Publish"
        onSubmit={async (title, body) => {
          const post = await createPost(await getToken(), title, body);
          router.push(`/blog/${post.slug}`);
        }}
      />
    </div>
  );
}
