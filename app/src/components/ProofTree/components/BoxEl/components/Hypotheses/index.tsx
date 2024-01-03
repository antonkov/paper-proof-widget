import React from "react";
import { ConvertedProofTree, HypNode, Highlights, Box } from "types";
import Table from "./components/Table";

interface Props {
  proofTree: ConvertedProofTree;
  highlights: Highlights;
  hypTables: Box['hypTables'];
}

const HypothesesComponent = (props: Props) => {
  return props.hypTables.map((hypTable, index) =>
    <Table key={index} proofTree={props.proofTree} highlights={props.highlights} hypTable={hypTable}/>
  )
}

export default HypothesesComponent;
