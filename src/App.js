import { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import earcut from "earcut";

const App = () => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const advancedTextureRef = useRef(null);
  const buttonsRef = useRef({});

  const [drawingMode, setDrawingMode] = useState(false);
  const [extrudingMode, setExtrudingMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [vertexEditMode, setVertexEditMode] = useState(false);
  const [activeButton, setActiveButton] = useState(null);

  const pointerDragBehavior = new BABYLON.PointerDragBehavior({
    dragPlaneNormal: BABYLON.Vector3.Up(),
  });

  const drawingRef = useRef(false);
  const extrudingRef = useRef(false);
  const moveRef = useRef(false);
  const vertexEditRef = useRef(false);

  const shapes = useRef([]);
  const currentDrawingPoints = useRef([]);
  const currentMeshSpheres = useRef([]);

  useEffect(() => {
    drawingRef.current = drawingMode;
    extrudingRef.current = extrudingMode;
    moveRef.current = moveMode;
    vertexEditRef.current = vertexEditMode;
  }, [drawingMode, extrudingMode, moveMode, vertexEditMode]);

  const handleModeChange = (modeSetter, buttonName) => {
    setDrawingMode(false);
    setExtrudingMode(false);
    setMoveMode(false);
    setVertexEditMode(false);
    modeSetter(true);
    setActiveButton(buttonName);
    updateButtonColors(buttonName);
  };

  const updateButtonColors = (activeName) => {
    Object.keys(buttonsRef.current).forEach((name) => {
      const button = buttonsRef.current[name];
      button.background = name === activeName ? "green" : "black";
    });
  };

  useEffect(() => {
    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2,
      5,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.position = new BABYLON.Vector3(0, 15, -30);
    camera.attachControl(canvasRef.current, true);

    const groundSize = 20;
    const gridDivisions = 20;
    const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.8, 1, 0.8);

    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: groundSize, height: groundSize, subdivisions: gridDivisions },
      scene
    );
    ground.position.y = 0;
    ground.material = groundMaterial;

    const lineColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    for (let i = 0; i <= gridDivisions; i++) {
      const xPos = (i / gridDivisions) * groundSize - groundSize / 2;
      const zPos = (i / gridDivisions) * groundSize - groundSize / 2;

      const verticalLine = BABYLON.MeshBuilder.CreateLines("vLine", {
        points: [
          new BABYLON.Vector3(xPos, 0.01, -groundSize / 2),
          new BABYLON.Vector3(xPos, 0.01, groundSize / 2)
        ]
      }, scene);
      verticalLine.color = lineColor;

      const horizontalLine = BABYLON.MeshBuilder.CreateLines("hLine", {
        points: [
          new BABYLON.Vector3(-groundSize / 2, 0.01, zPos),
          new BABYLON.Vector3(groundSize / 2, 0.01, zPos)
        ]
      }, scene);
      horizontalLine.color = lineColor;
    }

    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );

    const createPolygon = (points) => {
      const polygon = BABYLON.MeshBuilder.CreatePolygon(
        "polygonShape",
        { shape: points },
        scene,
        earcut
      );
      polygon.position.y = 0.01;
      const polygonMaterial = new BABYLON.StandardMaterial("polygonMaterial", scene);
      polygonMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0); 
      polygon.material = polygonMaterial;
      return polygon;
    };

    scene.onPointerDown = (event) => {
      if (drawingRef.current && event.button === 0) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit) {
          const point = pickResult.pickedPoint.clone();
          const marker = BABYLON.MeshBuilder.CreateSphere(
            "marker",
            { diameter: 0.2 },
            scene
          );
          currentMeshSpheres.current.push(marker);
          marker.position = point;
          currentDrawingPoints.current.push(point);
        }
      }

      if (drawingRef.current && event.button === 2 && currentDrawingPoints.current.length >= 3) {
        const newPolygon = createPolygon(currentDrawingPoints.current);
        shapes.current.push({
          polygon: newPolygon,
          points: [...currentDrawingPoints.current],
          extruded: null
        });

        currentMeshSpheres.current.forEach(sphere => sphere.dispose());
        currentMeshSpheres.current = [];
        currentDrawingPoints.current = [];
      }

      if (extrudingRef.current && event.button === 0) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit) {
          const clickedShape = shapes.current.find(shape => shape.polygon === pickResult.pickedMesh);
          if (clickedShape && !clickedShape.extruded) {
            const extrudedShape = BABYLON.MeshBuilder.ExtrudePolygon(
              "extrudedShape",
              {
                shape: clickedShape.points,
                depth: 2,
                wrap: true,
                updatable: true,
              },
              scene,
              earcut
            );
            extrudedShape.position.y = 2;
            const extrudeMat = new BABYLON.StandardMaterial("ExtrudedMeshMaterial", scene);
            extrudeMat.diffuseColor = new BABYLON.Color3(1, 1, 0);
            extrudeMat.backFaceCulling = false;
            extrudeMat.twoSidedLighting = true;
            extrudedShape.material = extrudeMat;

            clickedShape.polygon.dispose();
            clickedShape.extruded = extrudedShape;
            clickedShape.polygon = extrudedShape;
          }
        }
      }

      if (moveRef.current) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit) {
          const clickedShape = shapes.current.find(shape => shape.polygon === pickResult.pickedMesh);
          if (clickedShape) {
            clickedShape.polygon.addBehavior(pointerDragBehavior);
          } else {
            shapes.current.forEach(shape => {
              if (shape.polygon.behaviors.some(b => b === pointerDragBehavior)) {
                shape.polygon.removeBehavior(pointerDragBehavior);
              }
            });
          }
        }
      }

      if (vertexEditRef.current) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && event.button === 0) {
          const clickedShape = shapes.current.find(shape => shape.polygon === pickResult.pickedMesh);
          if (clickedShape && clickedShape.extruded) {
            let verticesData = [];
            const sharedVertices = new Map();
            const uniqueVertices = [];
            let originalVertexData = clickedShape.extruded.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const worldMatrix = clickedShape.extruded.getWorldMatrix();

            for (let i = 0; i < originalVertexData.length; i += 3) {
              const originalVertex = new BABYLON.Vector3(
                originalVertexData[i],
                originalVertexData[i + 1],
                originalVertexData[i + 2]
              );
              verticesData.push(originalVertex.asArray());
            }

            verticesData.forEach((vertex, index) => {
              const key = vertex.join(" ");
              if (sharedVertices.has(key)) {
                sharedVertices.set(key, [...sharedVertices.get(key), index]);
              } else {
                sharedVertices.set(key, [index]);
                const transformedVertex = BABYLON.Vector3.TransformCoordinates(
                  BABYLON.Vector3.FromArray(vertex),
                  worldMatrix
                ).asArray();
                uniqueVertices.push({ vertex: transformedVertex, key });
              }
            });

            uniqueVertices.forEach(({ vertex, key }) => {
              const indices = sharedVertices.get(key);
              const pointerDrag = new BABYLON.PointerDragBehavior();

              pointerDrag.onDragObservable.add((info) => {
                indices.forEach((index) => {
                  verticesData[index] = BABYLON.Vector3.FromArray(verticesData[index])
                    .add(info.delta)
                    .asArray();
                });
                clickedShape.extruded.updateVerticesData(BABYLON.VertexBuffer.PositionKind, verticesData.flat());
              });

              const sphere = BABYLON.MeshBuilder.CreateSphere("vertexSphere", { diameter: 0.3 }, scene);
              sphere.position = BABYLON.Vector3.FromArray(vertex);
              pointerDrag.dragDeltaRatio = 1;
              sphere.addBehavior(pointerDrag);
              clickedShape.vertexPoints = clickedShape.vertexPoints || [];
              clickedShape.vertexPoints.push(sphere);
            });
          }
        }
      }
    };

    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
    advancedTextureRef.current = advancedTexture;

    const buttonContainer = new GUI.StackPanel();
    buttonContainer.width = "250px";
    buttonContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    buttonContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    buttonContainer.paddingTopInPixels = "10px";
    buttonContainer.paddingLeftInPixels = "10px";
    advancedTexture.addControl(buttonContainer);

    const createButton = (name, text, onClick) => {
      const button = GUI.Button.CreateSimpleButton(name, text);
      button.width = "200px";
      button.height = "50px";
      button.color = "white";
      button.background = "black";
      button.thickness = 4;
      button.paddingTop = "5px";
      button.paddingBottom = "5px";
      button.fontSize = 20;
      button.onPointerClickObservable.add(onClick);
      buttonContainer.addControl(button);
      buttonsRef.current[name] = button;
    };

    createButton("drawButton", "Draw", () => handleModeChange(setDrawingMode, "drawButton"));
    createButton("extrudeButton", "Extrude", () => handleModeChange(setExtrudingMode, "extrudeButton"));
    createButton("moveButton", "Move", () => handleModeChange(setMoveMode, "moveButton"));
    createButton("vertexEditButton", "Edit Vertex", () => {
      if (vertexEditRef.current) {
        setVertexEditMode(false);
        shapes.current.forEach(shape => {
          if (shape.vertexPoints) {
            shape.vertexPoints.forEach(vertex => vertex.dispose());
            shape.vertexPoints = [];
          }
        });
        setActiveButton(null);
        updateButtonColors(null);
      } else {
        handleModeChange(setVertexEditMode, "vertexEditButton");
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    window.addEventListener("resize", () => {
      engine.resize();
    });

    return () => {
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100vh", display: "block" }}
    />
  );
};

export default App;