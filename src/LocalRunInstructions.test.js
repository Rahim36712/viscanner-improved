import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import LocalRunInstructions from "./LocalRunInstructions";

describe("LocalRunInstructions component", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  test("renders all local run commands", () => {
    act(() => {
      ReactDOM.render(<LocalRunInstructions />, container);
    });

    const text = container.textContent;
    expect(text).toContain("Run locally");
    expect(text).toContain("git clone https://github.com/wakhan-visualization/wakhan-visualization.github.io.git");
    expect(text).toContain("cd wakhan-visualization.github.io");
    expect(text).toContain("npm install");
    expect(text).toContain("npm start");
  });

  test("handles copy button click and shows copied feedback", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    act(() => {
      ReactDOM.render(<LocalRunInstructions />, container);
    });

    const copyBtn = container.querySelector("button");
    expect(copyBtn).toBeTruthy();
    expect(copyBtn.textContent).toContain("Copy");

    await act(async () => {
      copyBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("git clone https://github.com/wakhan-visualization/wakhan-visualization.github.io.git\ncd wakhan-visualization.github.io\nnpm install\nnpm start")
    );
    expect(copyBtn.textContent).toContain("Copied!");
  });
});
