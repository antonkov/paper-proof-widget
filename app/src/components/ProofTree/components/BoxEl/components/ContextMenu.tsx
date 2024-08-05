import React, { useContext, useEffect } from "react";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Divider, Switch } from "@mui/material";
import { GlobalContext } from "src/indexBrowser";
import { Box } from "types";

interface Props {
  box: Box;
  contextMenu: { mouseX: number; mouseY: number } | null;
  setContextMenu: React.Dispatch<React.SetStateAction<{ mouseX: number; mouseY: number } | null>>;
}

const ContextMenu = (props: Props) => {
  const {
    refreshUI,
    collapsedBoxIds,    setCollapsedBoxIds,
    isCompactMode,      setIsCompactMode,
    isCompactTactics,   setIsCompactTactics,
    isReadonlyMode,     setIsReadonlyMode,
    isCompactGoalNames, setIsCompactGoalNames,
  } = useContext(GlobalContext);

  const handleCompactMode = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsCompactMode(!isCompactMode);
    refreshUI();
  };

  const handleCompactGoalNames = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsCompactGoalNames(!isCompactGoalNames);
    refreshUI();
  };

  const handleCompactTactics = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsCompactTactics(!isCompactTactics);
    refreshUI();
  };

  const handleReadonlyMode = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsReadonlyMode(!isReadonlyMode);
    refreshUI();
  };

  const handleClose = (event: React.MouseEvent) => {
    event.stopPropagation();
    props.setContextMenu(null);
  };

  const isCollapsed = collapsedBoxIds.find((id) => props.box.id === id);

  const handleCollapse = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isCollapsed) {
      setCollapsedBoxIds(collapsedBoxIds.filter((id) => id !== props.box.id));
    } else {
      setCollapsedBoxIds([...collapsedBoxIds, props.box.id]);
    }
    props.setContextMenu(null);
    refreshUI();
  };

  const handleZoom = (event: React.MouseEvent, type: "in" | "out") => {
    event.stopPropagation();

    const proofTreeEl = document.getElementsByClassName("proof-tree")[0] as HTMLElement;
    if (!proofTreeEl) return;
    const initialScale = parseFloat(getComputedStyle(proofTreeEl).transform.split(',')[3]) || 1;
    proofTreeEl.style.transition = 'transform 0.2s';
    const increment = type === "in" ? 0.1 : -0.1;
    proofTreeEl.style.transform = `scale(${initialScale + increment})`;
    setTimeout(() => {
      proofTreeEl.style.transition = '';
    }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "≠") {
        handleZoom(event as any, "in");
      } else if (event.altKey && event.key === "–") {
        handleZoom(event as any, "out");
      }
    };

    addEventListener('keydown', handleKeyDown);

    return () => {
      removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <Menu
      open={props.contextMenu !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        props.contextMenu !== null
          ? { top: props.contextMenu.mouseY, left: props.contextMenu.mouseX }
          : undefined
      }
    >
      {
        props.box.id !== "1" &&
        <MenuItem onClick={handleCollapse}>
          {isCollapsed ? "Expand box" : "Collapse box"}
        </MenuItem>
      }
      { props.box.id !== "1" && <Divider/> }

      <MenuItem onClick={(event) => handleZoom(event, "in")}>
        <div className="text">Zoom in</div>
        <div className="shortcut">⎇ +</div>
      </MenuItem>

      <MenuItem onClick={(event) => handleZoom(event, "out")}>
        <div className="text">Zoom out</div>
        <div className="shortcut">⎇ -</div>
      </MenuItem>

      <MenuItem onClick={handleCompactMode}>
        <div className="text">Compact mode</div>
        <Switch checked={isCompactMode} size="small"/>
      </MenuItem>

      <MenuItem onClick={handleCompactTactics}>
        <div className="text">Compact tactics</div>
        <Switch checked={isCompactTactics} size="small"/>
      </MenuItem>

      <MenuItem onClick={handleCompactGoalNames}>
        <div className="text">Compact goal names</div>
        <Switch checked={isCompactGoalNames} size="small"/>
      </MenuItem>

      <Divider/>

      <MenuItem onClick={handleReadonlyMode}>
        <div className="text">Readonly mode</div>
        <Switch checked={isReadonlyMode} size="small"/>
      </MenuItem>
    </Menu>
  )
}

export default ContextMenu;
