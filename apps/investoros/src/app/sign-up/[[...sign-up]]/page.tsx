import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#09090f]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_70%)]" />
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/geo"
      />
    </div>
  );
}
