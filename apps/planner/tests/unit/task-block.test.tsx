// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskBlock } from "@/components/ui/task-block";

afterEach(cleanup);

describe("<TaskBlock>", () => {
  it("shows the title and time and tells screen readers what kind of block it is", () => {
    render(<TaskBlock title="AP Chem" timeLabel="9:00 – 10:15 AM" color="blue" kind="event" />);
    expect(screen.getByText("AP Chem")).toBeTruthy();
    expect(screen.getByText("9:00 – 10:15 AM")).toBeTruthy();
    expect(screen.getByText("(fixed event)")).toBeTruthy();
  });

  it("uses the chosen task color through a CSS variable", () => {
    render(<TaskBlock title="Gym" timeLabel="6 PM" color="green" />);
    const block = screen.getByRole("button");
    expect(block.style.getPropertyValue("--block")).toBe("var(--task-green)");
  });

  it("marks completed blocks and calls onClick", () => {
    const onClick = vi.fn();
    render(<TaskBlock title="Essay" timeLabel="8 PM" color="orange" completed onClick={onClick} />);
    expect(screen.getByLabelText("Completed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
