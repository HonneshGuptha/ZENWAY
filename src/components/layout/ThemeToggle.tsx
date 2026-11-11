import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-lg text-muted-foreground"
        aria-label="Toggle theme"
      >
        <span className="size-4.5" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Moon className="size-4.5 text-sky-400 transition-transform" />
          ) : (
            <Sun className="size-4.5 text-amber-500 transition-transform" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      } />
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-32">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`gap-2 cursor-pointer ${theme === "light" ? "font-semibold text-primary" : ""}`}
        >
          <Sun className="size-4 text-amber-500" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`gap-2 cursor-pointer ${theme === "dark" ? "font-semibold text-primary" : ""}`}
        >
          <Moon className="size-4 text-sky-400" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`gap-2 cursor-pointer ${theme === "system" ? "font-semibold text-primary" : ""}`}
        >
          <Laptop className="size-4 text-muted-foreground" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
