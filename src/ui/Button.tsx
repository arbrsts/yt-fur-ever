import { Button as ReactAriaButton } from "react-aria-components";

export const Button = ({ children, onPress }) => {
  return (
    <ReactAriaButton
      onPress={(e) => {
        onPress(e);
      }}
      className="border border-dashed px-2"
    >
      {children}
    </ReactAriaButton>
  );
};
