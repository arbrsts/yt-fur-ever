export const LoadingSpinner = ({
  size = "md",
  color = "blue",
  loading = true, // Add loading prop with default true
}) => {
  // If not loading, return null
  if (!loading) return null;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const colorClasses = {
    blue: "border-blue-500",
    red: "border-red-500",
    green: "border-green-500",
    purple: "border-purple-500",
    gray: "border-gray-500",
  };

  return (
    <div
      className={`${sizeClasses[size]} border-4 border-t-transparent rounded-full animate-spin ${colorClasses[color]}`}
      role="status"
      aria-label="loading"
    />
  );
};
