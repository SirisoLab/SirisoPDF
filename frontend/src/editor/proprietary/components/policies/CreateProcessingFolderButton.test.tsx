import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateProcessingFolderButton } from "@editor/components/policies/CreateProcessingFolderButton";

const { signedIn, open } = vi.hoisted(() => ({
  signedIn: { value: true },
  open: vi.fn(),
}));

vi.mock("@editor/components/policies/usePoliciesEnabled", () => ({
  usePoliciesEnabled: () => signedIn.value,
}));

vi.mock("@editor/hooks/useProcessingFolderCreation", () => ({
  useProcessingFolderCreation: () => ({ open, dialog: null }),
}));

function renderButton() {
  return render(
    <MantineProvider>
      <CreateProcessingFolderButton />
    </MantineProvider>,
  );
}

beforeEach(() => {
  signedIn.value = true;
  open.mockClear();
});

describe("CreateProcessingFolderButton", () => {
  it("opens the creation flow when signed in", () => {
    renderButton();
    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when signed out", () => {
    signedIn.value = false;
    renderButton();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
